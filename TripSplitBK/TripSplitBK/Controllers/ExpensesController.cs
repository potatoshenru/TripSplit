using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TripSplitBK.Data;
using TripSplitBK.Dtos;
using TripSplitBK.Models;

namespace TripSplitBK.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExpensesController : ControllerBase
{
    private readonly TripSplitDbContext _db;
    private readonly IWebHostEnvironment _env;

    public ExpensesController(TripSplitDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string tripId = "trip_default")
    {
        var expenses = await _db.Expenses
            .Where(e => e.TripId == tripId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = expenses });
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddExpenseRequest req)
    {
        var tripId = req.TripId;
        var currency = req.OriginalCurrency;
        var amountOriginal = req.AmountOriginal;

        // 取得匯率
        decimal rate;
        if (req.ExchangeRateToTwd.HasValue)
        {
            rate = req.ExchangeRateToTwd.Value;
        }
        else
        {
            rate = await GetRateToTwd(currency);
        }

        var amountTwd = Math.Round(amountOriginal * rate);
        var expenseId = $"exp_{Guid.NewGuid()}";
        var now = DateTime.UtcNow;

        var category = await _db.Categories.FirstOrDefaultAsync(c => c.CategoryId == req.CategoryId);
        var paymentMethod = await _db.PaymentMethods.FirstOrDefaultAsync(p => p.PaymentMethodId == req.PaymentMethodId);

        var expense = new Expense
        {
            ExpenseId = expenseId,
            TripId = tripId,
            Title = req.Title,
            PayerMemberName = req.PayerMemberName,
            CategoryId = req.CategoryId,
            CategoryName = category?.CategoryName ?? "",
            PaymentMethodId = req.PaymentMethodId,
            PaymentMethodName = paymentMethod?.PaymentMethodName ?? "",
            ExpenseDate = req.ExpenseDate ?? "",
            AmountOriginal = amountOriginal,
            OriginalCurrency = currency,
            ExchangeRateToTwd = rate,
            AmountTwd = amountTwd,
            SplitType = req.SplitType,
            Note = req.Note ?? "",
            CreatedAt = now
        };
        _db.Expenses.Add(expense);

        // 處理分帳參與者
        var participantNames = (req.Participants ?? new List<ParticipantInput>())
            .Select(p => p.MemberName)
            .Where(n => !string.IsNullOrEmpty(n))
            .ToList();

        var splitMap = (req.SplitDetails ?? new List<SplitDetailInput>())
            .Where(d => !string.IsNullOrEmpty(d.MemberName))
            .ToDictionary(d => d.MemberName, d => d);

        var participantsCount = participantNames.Count > 0 ? participantNames.Count : 1;

        foreach (var memberName in participantNames)
        {
            splitMap.TryGetValue(memberName, out var detail);
            decimal shareAmountTwd = 0;
            decimal sharePercentage = 0;

            switch (req.SplitType)
            {
                case "百分比分":
                    var percent = detail?.SharePercentage ?? 0;
                    sharePercentage = percent;
                    shareAmountTwd = Math.Round(amountTwd * (percent / 100));
                    break;
                case "自訂金額":
                    var shareOriginal = detail?.ShareAmountOriginal ?? 0;
                    shareAmountTwd = Math.Round(shareOriginal * rate);
                    if (amountOriginal > 0)
                        sharePercentage = Math.Round(shareOriginal / amountOriginal * 100, 4);
                    break;
                default: // 平均分
                    shareAmountTwd = Math.Round(amountTwd / participantsCount);
                    sharePercentage = Math.Round(100m / participantsCount, 4);
                    break;
            }

            _db.ExpenseParticipants.Add(new ExpenseParticipant
            {
                ParticipantId = $"part_{Guid.NewGuid()}",
                ExpenseId = expenseId,
                MemberName = memberName,
                ShareAmountTwd = shareAmountTwd,
                SharePercentage = sharePercentage,
                CreatedAt = now
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = new { expense } });
    }

    [HttpPost("{expenseId}/receipts")]
    public async Task<IActionResult> UploadReceipt(string expenseId, IFormFile file)
    {
        var uploadsDir = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "receipts");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{expenseId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(uploadsDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var receipt = new ExpenseReceipt
        {
            ReceiptId = $"receipt_{Guid.NewGuid()}",
            ExpenseId = expenseId,
            FileName = file.FileName,
            MimeType = file.ContentType,
            FilePath = filePath,
            FileUrl = $"/receipts/{fileName}",
            CreatedAt = DateTime.UtcNow
        };
        _db.ExpenseReceipts.Add(receipt);
        await _db.SaveChangesAsync();

        return Ok(new ApiResponse<object> { Ok = true, Data = receipt });
    }

    private async Task<decimal> GetRateToTwd(string currency)
    {
        if (currency == "TWD") return 1;

        var rate = await _db.ExchangeRates
            .Where(r => r.BaseCurrency == currency && r.TargetCurrency == "TWD")
            .OrderByDescending(r => r.FetchedAt)
            .FirstOrDefaultAsync();

        if (rate == null)
            throw new InvalidOperationException($"No exchange rate found for {currency} to TWD.");

        return rate.RateToTwd;
    }
}
