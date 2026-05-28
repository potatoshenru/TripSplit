using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TripSplitBK.Data;
using TripSplitBK.Dtos;
using TripSplitBK.Models;

namespace TripSplitBK.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MembersController : ControllerBase
{
    private readonly TripSplitDbContext _db;

    public MembersController(TripSplitDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string tripId = "trip_default")
    {
        var members = await _db.Members.Where(m => m.TripId == tripId && m.IsActive).ToListAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = members });
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddMemberRequest req)
    {
        var member = new Member
        {
            MemberId = $"mem_{Guid.NewGuid()}",
            TripId = req.TripId,
            MemberName = req.MemberName,
            EmailOrNote = req.EmailOrNote ?? "",
            AvatarText = req.AvatarText ?? req.MemberName.Trim()[..1].ToUpper(),
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        _db.Members.Add(member);
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = member });
    }

    [HttpDelete("{memberId}")]
    public async Task<IActionResult> Delete(string memberId)
    {
        var member = await _db.Members.FirstOrDefaultAsync(m => m.MemberId == memberId);
        if (member == null) return Ok(new ApiResponse<object> { Ok = true, Data = new { deleted = false, id = memberId } });

        member.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = new { deleted = true, id = memberId } });
    }
}
