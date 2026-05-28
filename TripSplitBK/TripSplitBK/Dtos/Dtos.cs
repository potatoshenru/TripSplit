namespace TripSplitBK.Dtos;

public class AddTripRequest
{
    public string? TripId { get; set; }
    public string TripName { get; set; } = string.Empty;
    public string BaseCurrency { get; set; } = "TWD";
    public string CreatedBy { get; set; } = string.Empty;
    public List<string[]>? Members { get; set; }
}

public class AddMemberRequest
{
    public string TripId { get; set; } = "trip_default";
    public string MemberName { get; set; } = string.Empty;
    public string? EmailOrNote { get; set; }
    public string? AvatarText { get; set; }
}

public class AddCategoryRequest
{
    public string TripId { get; set; } = "trip_default";
    public string CategoryName { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Note { get; set; }
}

public class AddPaymentMethodRequest
{
    public string TripId { get; set; } = "trip_default";
    public string PaymentMethodName { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Note { get; set; }
}

public class AddExpenseRequest
{
    public string TripId { get; set; } = "trip_default";
    public string Title { get; set; } = string.Empty;
    public string PayerMemberName { get; set; } = string.Empty;
    public string CategoryId { get; set; } = string.Empty;
    public string PaymentMethodId { get; set; } = string.Empty;
    public string? ExpenseDate { get; set; }
    public decimal AmountOriginal { get; set; }
    public string OriginalCurrency { get; set; } = string.Empty;
    public decimal? ExchangeRateToTwd { get; set; }
    public string SplitType { get; set; } = "平均分";
    public string? Note { get; set; }
    public List<ParticipantInput>? Participants { get; set; }
    public List<SplitDetailInput>? SplitDetails { get; set; }
}

public class ParticipantInput
{
    public string MemberName { get; set; } = string.Empty;
}

public class SplitDetailInput
{
    public string MemberName { get; set; } = string.Empty;
    public decimal? SharePercentage { get; set; }
    public decimal? ShareAmountOriginal { get; set; }
}

public class TripIdRequest
{
    public string TripId { get; set; } = string.Empty;
}

public class ApiResponse<T>
{
    public bool Ok { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
}
