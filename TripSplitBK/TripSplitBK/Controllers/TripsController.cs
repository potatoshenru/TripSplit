using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TripSplitBK.Data;
using TripSplitBK.Dtos;
using TripSplitBK.Models;

namespace TripSplitBK.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TripsController : ControllerBase
{
    private readonly TripSplitDbContext _db;

    public TripsController(TripSplitDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetTrips()
    {
        var trips = await _db.Trips.Where(t => !t.IsArchived).ToListAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = trips });
    }

    [HttpGet("archived")]
    public async Task<IActionResult> GetArchivedTrips()
    {
        var trips = await _db.Trips.Where(t => t.IsArchived).ToListAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = trips });
    }

    [HttpGet("{tripId}")]
    public async Task<IActionResult> GetInitialData(string tripId)
    {
        var trip = await _db.Trips.FirstOrDefaultAsync(t => t.TripId == tripId);
        var members = await _db.Members.Where(m => m.TripId == tripId && m.IsActive).ToListAsync();
        var categories = await _db.Categories.Where(c => c.TripId == tripId && c.IsActive).ToListAsync();
        var paymentMethods = await _db.PaymentMethods.Where(p => p.TripId == tripId && p.IsActive).ToListAsync();
        var expenses = await _db.Expenses.Where(e => e.TripId == tripId).OrderByDescending(e => e.CreatedAt).ToListAsync();
        var expenseIds = expenses.Select(e => e.ExpenseId).ToList();
        var receipts = await _db.ExpenseReceipts.Where(r => expenseIds.Contains(r.ExpenseId)).ToListAsync();

        var latestRates = await _db.ExchangeRates
            .GroupBy(r => new { r.BaseCurrency, r.TargetCurrency })
            .Select(g => g.OrderByDescending(r => r.FetchedAt).First())
            .ToListAsync();

        return Ok(new ApiResponse<object>
        {
            Ok = true,
            Data = new
            {
                trip,
                members,
                categories,
                paymentMethods,
                exchangeRates = latestRates,
                expenses,
                expenseReceipts = receipts
            }
        });
    }

    [HttpPost]
    public async Task<IActionResult> AddTrip([FromBody] AddTripRequest req)
    {
        var tripId = req.TripId ?? $"trip_{Guid.NewGuid()}";
        var existing = await _db.Trips.FirstOrDefaultAsync(t => t.TripId == tripId);
        if (existing != null)
            return Ok(new ApiResponse<object> { Ok = true, Data = existing });

        var now = DateTime.UtcNow;
        var trip = new Trip
        {
            TripId = tripId,
            TripName = req.TripName,
            BaseCurrency = req.BaseCurrency,
            CreatedBy = req.CreatedBy,
            CreatedAt = now,
            UpdatedAt = now,
            IsArchived = false
        };
        _db.Trips.Add(trip);

        // 預設成員
        var members = req.Members ?? new List<string[]>
        {
            new[] { "Dustin", "發起人", "D" },
            new[] { "Amy", "旅伴", "A" },
            new[] { "Ben", "旅伴", "B" },
            new[] { "Cindy", "旅伴", "C" }
        };
        foreach (var m in members)
        {
            _db.Members.Add(new Member
            {
                MemberId = $"mem_{Guid.NewGuid()}",
                TripId = tripId,
                MemberName = m[0],
                EmailOrNote = m.Length > 1 ? m[1] : "旅伴",
                AvatarText = m.Length > 2 ? m[2] : m[0][..1].ToUpper(),
                CreatedAt = now,
                IsActive = true
            });
        }

        // 預設分類
        var defaultCategories = new[] {
            ("餐飲", "🍜", "預設分類"), ("早餐", "🍳", "自訂分類"), ("門票", "🎟", "自訂分類"),
            ("交通", "🚆", "預設分類"), ("住宿", "🏨", "預設分類"), ("購物", "🛍", "預設分類")
        };
        foreach (var (name, icon, note) in defaultCategories)
        {
            _db.Categories.Add(new Category
            {
                CategoryId = $"cat_{Guid.NewGuid()}",
                TripId = tripId,
                CategoryName = name,
                Icon = icon,
                Note = note,
                CreatedAt = now,
                IsActive = true
            });
        }

        // 預設付款方式
        var defaultPayments = new[] {
            ("現金", "💵", "預設方式"), ("Visa", "💳", "信用卡"),
            ("LINE Pay", "📱", "行動支付"), ("Suica", "🚇", "交通卡")
        };
        foreach (var (name, icon, note) in defaultPayments)
        {
            _db.PaymentMethods.Add(new PaymentMethod
            {
                PaymentMethodId = $"pay_{Guid.NewGuid()}",
                TripId = tripId,
                PaymentMethodName = name,
                Icon = icon,
                Note = note,
                CreatedAt = now,
                IsActive = true
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = trip });
    }

    [HttpPost("{tripId}/archive")]
    public async Task<IActionResult> ArchiveTrip(string tripId)
    {
        var trip = await _db.Trips.FirstOrDefaultAsync(t => t.TripId == tripId);
        if (trip == null) return Ok(new ApiResponse<object> { Ok = true, Data = new { archived = false, trip_id = tripId } });

        trip.IsArchived = true;
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = new { archived = true, trip_id = tripId } });
    }

    [HttpPost("{tripId}/unarchive")]
    public async Task<IActionResult> UnarchiveTrip(string tripId)
    {
        var trip = await _db.Trips.FirstOrDefaultAsync(t => t.TripId == tripId);
        if (trip == null) return Ok(new ApiResponse<object> { Ok = true, Data = new { unarchived = false, trip_id = tripId } });

        trip.IsArchived = false;
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = new { unarchived = true, trip_id = tripId } });
    }
}
