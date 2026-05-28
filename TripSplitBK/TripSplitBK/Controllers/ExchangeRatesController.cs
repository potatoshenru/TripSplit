using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TripSplitBK.Data;
using TripSplitBK.Dtos;
using TripSplitBK.Models;

namespace TripSplitBK.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ExchangeRatesController : ControllerBase
{
    private readonly TripSplitDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public ExchangeRatesController(TripSplitDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetLatest()
    {
        var rates = await _db.ExchangeRates
            .GroupBy(r => new { r.BaseCurrency, r.TargetCurrency })
            .Select(g => g.OrderByDescending(r => r.FetchedAt).First())
            .ToListAsync();

        return Ok(new ApiResponse<object> { Ok = true, Data = rates });
    }

    [HttpPost("sync")]
    public async Task<IActionResult> Sync()
    {
        var currencies = new[] { "JPY", "USD", "KRW", "EUR", "THB", "TWD" };
        var client = _httpClientFactory.CreateClient();
        var response = await client.GetAsync("https://open.er-api.com/v6/latest/TWD");
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var apiRates = doc.RootElement.GetProperty("rates");

        var now = DateTime.UtcNow;
        var result = new Dictionary<string, decimal>();

        foreach (var currency in currencies)
        {
            decimal rateToTwd;
            if (currency == "TWD")
            {
                rateToTwd = 1;
            }
            else
            {
                if (!apiRates.TryGetProperty(currency, out var rateElement))
                    throw new InvalidOperationException($"Missing rate for {currency}");

                rateToTwd = Math.Round(1m / rateElement.GetDecimal(), 6);
            }

            result[currency] = rateToTwd;

            _db.ExchangeRates.Add(new ExchangeRate
            {
                RateId = $"rate_{Guid.NewGuid()}",
                BaseCurrency = currency,
                TargetCurrency = "TWD",
                RateToTwd = rateToTwd,
                Provider = "open.er-api.com",
                FetchedAt = now
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new ApiResponse<object> { Ok = true, Data = new { fetched_at = now, rates = result } });
    }
}
