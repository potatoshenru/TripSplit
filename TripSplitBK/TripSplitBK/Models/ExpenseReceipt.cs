using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TripSplitBK.Models;

[Table("expense_receipts")]
public class ExpenseReceipt
{
    [Key]
    [MaxLength(100)]
    public string ReceiptId { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ExpenseId { get; set; } = string.Empty;

    [MaxLength(300)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string MimeType { get; set; } = string.Empty;

    [MaxLength(500)]
    public string FilePath { get; set; } = string.Empty;

    [MaxLength(500)]
    public string FileUrl { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(ExpenseId))]
    public Expense? Expense { get; set; }
}
