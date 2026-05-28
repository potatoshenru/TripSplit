using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using TripSplitBK.Utils;

namespace TripSplitBK.Models;

[Table("expenses")]
public class Expense
{
    [Key]
    [MaxLength(100)]
    public string ExpenseId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string TripId { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(100)]
    public string PayerMemberName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string CategoryId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string CategoryName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string PaymentMethodId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string PaymentMethodName { get; set; } = string.Empty;

    [MaxLength(50)]
    public string ExpenseDate { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal AmountOriginal { get; set; }

    [MaxLength(10)]
    public string OriginalCurrency { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,6)")]
    public decimal ExchangeRateToTwd { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal AmountTwd { get; set; }

    [MaxLength(50)]
    public string SplitType { get; set; } = "平均分";

    [MaxLength(500)]
    public string Note { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = TaipeiTimeUtil.GetCurrentTime();

    [ForeignKey(nameof(TripId))]
    public Trip? Trip { get; set; }

    public ICollection<ExpenseParticipant> Participants { get; set; } = new List<ExpenseParticipant>();
    public ICollection<ExpenseReceipt> Receipts { get; set; } = new List<ExpenseReceipt>();
}
