using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TripSplitBK.Models;

[Table("categories")]
public class Category
{
    [Key]
    [MaxLength(100)]
    public string CategoryId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string TripId { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string CategoryName { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Icon { get; set; } = "🏷";

    [MaxLength(200)]
    public string Note { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    [ForeignKey(nameof(TripId))]
    public Trip? Trip { get; set; }
}
