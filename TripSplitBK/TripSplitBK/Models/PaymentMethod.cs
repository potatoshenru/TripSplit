using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TripSplitBK.Models;

[Table("payment_methods")]
public class PaymentMethod
{
    [Key]
    [MaxLength(100)]
    public string PaymentMethodId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string TripId { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string PaymentMethodName { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Icon { get; set; } = "💳";

    [MaxLength(200)]
    public string Note { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    [ForeignKey(nameof(TripId))]
    public Trip? Trip { get; set; }
}
