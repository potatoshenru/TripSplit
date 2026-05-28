using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TripSplitBK.Models;

[Table("exchange_rates")]
public class ExchangeRate
{
    [Key]
    [MaxLength(100)]
    public string RateId { get; set; } = string.Empty;

    [MaxLength(10)]
    public string BaseCurrency { get; set; } = string.Empty;

    [MaxLength(10)]
    public string TargetCurrency { get; set; } = "TWD";

    [Column(TypeName = "decimal(18,6)")]
    public decimal RateToTwd { get; set; }

    [MaxLength(100)]
    public string Provider { get; set; } = string.Empty;

    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;
}
