using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TripSplitBK.Models;

[Table("expense_participants")]
public class ExpenseParticipant
{
    [Key]
    [MaxLength(100)]
    public string ParticipantId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ExpenseId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string MemberName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal ShareAmountTwd { get; set; }

    [Column(TypeName = "decimal(18,4)")]
    public decimal SharePercentage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(ExpenseId))]
    public Expense? Expense { get; set; }
}
