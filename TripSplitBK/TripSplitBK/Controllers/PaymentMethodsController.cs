using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TripSplitBK.Data;
using TripSplitBK.Dtos;
using TripSplitBK.Models;

namespace TripSplitBK.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentMethodsController : ControllerBase
{
    private readonly TripSplitDbContext _db;

    public PaymentMethodsController(TripSplitDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string tripId = "trip_default")
    {
        var methods = await _db.PaymentMethods.Where(p => p.TripId == tripId && p.IsActive).ToListAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = methods });
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddPaymentMethodRequest req)
    {
        var method = new PaymentMethod
        {
            PaymentMethodId = $"pay_{Guid.NewGuid()}",
            TripId = req.TripId,
            PaymentMethodName = req.PaymentMethodName,
            Icon = req.Icon ?? "💳",
            Note = req.Note ?? "自訂付款方式",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        _db.PaymentMethods.Add(method);
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = method });
    }

    [HttpDelete("{paymentMethodId}")]
    public async Task<IActionResult> Delete(string paymentMethodId)
    {
        var method = await _db.PaymentMethods.FirstOrDefaultAsync(p => p.PaymentMethodId == paymentMethodId);
        if (method == null) return Ok(new ApiResponse<object> { Ok = true, Data = new { deleted = false, id = paymentMethodId } });

        method.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = new { deleted = true, id = paymentMethodId } });
    }
}
