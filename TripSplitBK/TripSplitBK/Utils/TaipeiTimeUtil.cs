namespace TripSplitBK.Utils;

/// <summary>
/// 台北標準時間（Taiwan Standard Time, UTC+8）工具類別
/// 用於統一管理應用程式中的所有時間，確保與主機時區無關
/// </summary>
public static class TaipeiTimeUtil
{
    /// <summary>
    /// 台北時區標識 (Asia/Taipei)
    /// </summary>
    private static readonly TimeZoneInfo TaipeiTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Taipei");

    /// <summary>
    /// 獲取當前台北標準時間
    /// </summary>
    /// <returns>台北標準時間的 DateTime (Kind = Unspecified)</returns>
    public static DateTime GetCurrentTime()
    {
        var utcNow = DateTime.UtcNow;
        return TimeZoneInfo.ConvertTime(utcNow, TaipeiTimeZone);
    }

    /// <summary>
    /// 將 UTC 時間轉換為台北標準時間
    /// </summary>
    public static DateTime ConvertUtcToTaipei(DateTime utcDateTime)
    {
        if (utcDateTime.Kind != DateTimeKind.Utc)
            utcDateTime = DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);

        return TimeZoneInfo.ConvertTime(utcDateTime, TaipeiTimeZone);
    }

    /// <summary>
    /// 將台北標準時間轉換為 UTC
    /// </summary>
    public static DateTime ConvertTaipeiToUtc(DateTime taipeiDateTime)
    {
        if (taipeiDateTime.Kind == DateTimeKind.Utc)
            return taipeiDateTime;

        var unspecifiedKind = DateTime.SpecifyKind(taipeiDateTime, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(unspecifiedKind, TaipeiTimeZone);
    }
}
