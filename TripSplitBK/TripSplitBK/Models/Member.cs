using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TripSplitBK.Utils;

namespace TripSplitBK.Models;

[Table("members")]
public class Member
{
    [Key]
    [MaxLength(100)]
    public string MemberId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string TripId { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string MemberName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string EmailOrNote { get; set; } = string.Empty;

    [MaxLength(10)]
    public string AvatarText { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    [ForeignKey(nameof(TripId))]
    public Trip? Trip { get; set; }
}
