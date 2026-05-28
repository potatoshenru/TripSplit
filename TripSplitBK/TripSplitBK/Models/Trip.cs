using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TripSplitBK.Models;

[Table("trips")]
public class Trip
{
    [Key]
    [MaxLength(100)]
    public string TripId { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string TripName { get; set; } = string.Empty;

    [MaxLength(10)]
    public string BaseCurrency { get; set; } = "TWD";

    [MaxLength(100)]
    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public bool IsArchived { get; set; }

    public ICollection<Member> Members { get; set; } = new List<Member>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<PaymentMethod> PaymentMethods { get; set; } = new List<PaymentMethod>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
}
