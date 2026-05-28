using Microsoft.EntityFrameworkCore;
using TripSplitBK.Models;

namespace TripSplitBK.Data;

public class TripSplitDbContext : DbContext
{
    public TripSplitDbContext(DbContextOptions<TripSplitDbContext> options) : base(options) { }

    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();
    public DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<ExpenseReceipt> ExpenseReceipts => Set<ExpenseReceipt>();
    public DbSet<ExpenseParticipant> ExpenseParticipants => Set<ExpenseParticipant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Seed default trip
        var now = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        const string tripId = "trip_default";

        modelBuilder.Entity<Trip>().HasData(new Trip
        {
            TripId = tripId,
            TripName = "東京五日遊",
            BaseCurrency = "TWD",
            CreatedBy = "Dustin",
            CreatedAt = now,
            UpdatedAt = now,
            IsArchived = false
        });

        // Seed members
        modelBuilder.Entity<Member>().HasData(
            new Member { MemberId = "mem_1", TripId = tripId, MemberName = "Dustin", EmailOrNote = "發起人", AvatarText = "D", CreatedAt = now, IsActive = true },
            new Member { MemberId = "mem_2", TripId = tripId, MemberName = "Amy", EmailOrNote = "旅伴", AvatarText = "A", CreatedAt = now, IsActive = true },
            new Member { MemberId = "mem_3", TripId = tripId, MemberName = "Ben", EmailOrNote = "旅伴", AvatarText = "B", CreatedAt = now, IsActive = true },
            new Member { MemberId = "mem_4", TripId = tripId, MemberName = "Cindy", EmailOrNote = "旅伴", AvatarText = "C", CreatedAt = now, IsActive = true }
        );

        // Seed categories
        modelBuilder.Entity<Category>().HasData(
            new Category { CategoryId = "cat_1", TripId = tripId, CategoryName = "餐飲", Icon = "🍜", Note = "預設分類", CreatedAt = now, IsActive = true },
            new Category { CategoryId = "cat_2", TripId = tripId, CategoryName = "早餐", Icon = "🍳", Note = "自訂分類", CreatedAt = now, IsActive = true },
            new Category { CategoryId = "cat_3", TripId = tripId, CategoryName = "門票", Icon = "🎟", Note = "自訂分類", CreatedAt = now, IsActive = true },
            new Category { CategoryId = "cat_4", TripId = tripId, CategoryName = "交通", Icon = "🚆", Note = "預設分類", CreatedAt = now, IsActive = true },
            new Category { CategoryId = "cat_5", TripId = tripId, CategoryName = "住宿", Icon = "🏨", Note = "預設分類", CreatedAt = now, IsActive = true },
            new Category { CategoryId = "cat_6", TripId = tripId, CategoryName = "購物", Icon = "🛍", Note = "預設分類", CreatedAt = now, IsActive = true }
        );

        // Seed payment methods
        modelBuilder.Entity<PaymentMethod>().HasData(
            new PaymentMethod { PaymentMethodId = "pay_1", TripId = tripId, PaymentMethodName = "現金", Icon = "💵", Note = "預設方式", CreatedAt = now, IsActive = true },
            new PaymentMethod { PaymentMethodId = "pay_2", TripId = tripId, PaymentMethodName = "Visa", Icon = "💳", Note = "信用卡", CreatedAt = now, IsActive = true },
            new PaymentMethod { PaymentMethodId = "pay_3", TripId = tripId, PaymentMethodName = "LINE Pay", Icon = "📱", Note = "行動支付", CreatedAt = now, IsActive = true },
            new PaymentMethod { PaymentMethodId = "pay_4", TripId = tripId, PaymentMethodName = "Suica", Icon = "🚇", Note = "交通卡", CreatedAt = now, IsActive = true }
        );

        // Seed exchange rates
        modelBuilder.Entity<ExchangeRate>().HasData(
            new ExchangeRate { RateId = "rate_seed_jpy", BaseCurrency = "JPY", TargetCurrency = "TWD", RateToTwd = 0.2185m, Provider = "seed", FetchedAt = now },
            new ExchangeRate { RateId = "rate_seed_usd", BaseCurrency = "USD", TargetCurrency = "TWD", RateToTwd = 32.1m, Provider = "seed", FetchedAt = now },
            new ExchangeRate { RateId = "rate_seed_krw", BaseCurrency = "KRW", TargetCurrency = "TWD", RateToTwd = 0.0235m, Provider = "seed", FetchedAt = now },
            new ExchangeRate { RateId = "rate_seed_eur", BaseCurrency = "EUR", TargetCurrency = "TWD", RateToTwd = 34.8m, Provider = "seed", FetchedAt = now },
            new ExchangeRate { RateId = "rate_seed_thb", BaseCurrency = "THB", TargetCurrency = "TWD", RateToTwd = 0.88m, Provider = "seed", FetchedAt = now },
            new ExchangeRate { RateId = "rate_seed_twd", BaseCurrency = "TWD", TargetCurrency = "TWD", RateToTwd = 1m, Provider = "seed", FetchedAt = now }
        );
    }
}
