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
    }
}
