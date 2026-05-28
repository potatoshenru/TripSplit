using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TripSplitBK.Data;
using TripSplitBK.Dtos;
using TripSplitBK.Models;

namespace TripSplitBK.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly TripSplitDbContext _db;

    public CategoriesController(TripSplitDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string tripId = "trip_default")
    {
        var categories = await _db.Categories.Where(c => c.TripId == tripId && c.IsActive).ToListAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = categories });
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddCategoryRequest req)
    {
        var category = new Category
        {
            CategoryId = $"cat_{Guid.NewGuid()}",
            TripId = req.TripId,
            CategoryName = req.CategoryName,
            Icon = req.Icon ?? "🏷",
            Note = req.Note ?? "自訂分類",
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = category });
    }

    [HttpDelete("{categoryId}")]
    public async Task<IActionResult> Delete(string categoryId)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.CategoryId == categoryId);
        if (category == null) return Ok(new ApiResponse<object> { Ok = true, Data = new { deleted = false, id = categoryId } });

        category.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = new { deleted = true, id = categoryId } });
    }
}
