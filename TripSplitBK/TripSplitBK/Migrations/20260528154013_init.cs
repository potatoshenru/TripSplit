using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TripSplitBK.Migrations
{
    /// <inheritdoc />
    public partial class init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "exchange_rates",
                columns: table => new
                {
                    RateId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BaseCurrency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    TargetCurrency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    RateToTwd = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FetchedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_exchange_rates", x => x.RateId);
                });

            migrationBuilder.CreateTable(
                name: "trips",
                columns: table => new
                {
                    TripId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TripName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BaseCurrency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsArchived = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trips", x => x.TripId);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    CategoryId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TripId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CategoryName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.CategoryId);
                    table.ForeignKey(
                        name: "FK_categories_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "trips",
                        principalColumn: "TripId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "expenses",
                columns: table => new
                {
                    ExpenseId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TripId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PayerMemberName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CategoryId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CategoryName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PaymentMethodId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PaymentMethodName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ExpenseDate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AmountOriginal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OriginalCurrency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ExchangeRateToTwd = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    AmountTwd = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SplitType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expenses", x => x.ExpenseId);
                    table.ForeignKey(
                        name: "FK_expenses_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "trips",
                        principalColumn: "TripId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "members",
                columns: table => new
                {
                    MemberId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TripId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MemberName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EmailOrNote = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    AvatarText = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_members", x => x.MemberId);
                    table.ForeignKey(
                        name: "FK_members_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "trips",
                        principalColumn: "TripId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payment_methods",
                columns: table => new
                {
                    PaymentMethodId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TripId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PaymentMethodName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_methods", x => x.PaymentMethodId);
                    table.ForeignKey(
                        name: "FK_payment_methods_trips_TripId",
                        column: x => x.TripId,
                        principalTable: "trips",
                        principalColumn: "TripId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "expense_participants",
                columns: table => new
                {
                    ParticipantId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ExpenseId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MemberName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ShareAmountTwd = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SharePercentage = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expense_participants", x => x.ParticipantId);
                    table.ForeignKey(
                        name: "FK_expense_participants_expenses_ExpenseId",
                        column: x => x.ExpenseId,
                        principalTable: "expenses",
                        principalColumn: "ExpenseId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "expense_receipts",
                columns: table => new
                {
                    ReceiptId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ExpenseId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    MimeType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expense_receipts", x => x.ReceiptId);
                    table.ForeignKey(
                        name: "FK_expense_receipts_expenses_ExpenseId",
                        column: x => x.ExpenseId,
                        principalTable: "expenses",
                        principalColumn: "ExpenseId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "exchange_rates",
                columns: new[] { "RateId", "BaseCurrency", "FetchedAt", "Provider", "RateToTwd", "TargetCurrency" },
                values: new object[,]
                {
                    { "rate_seed_eur", "EUR", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "seed", 34.8m, "TWD" },
                    { "rate_seed_jpy", "JPY", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "seed", 0.2185m, "TWD" },
                    { "rate_seed_krw", "KRW", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "seed", 0.0235m, "TWD" },
                    { "rate_seed_thb", "THB", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "seed", 0.88m, "TWD" },
                    { "rate_seed_twd", "TWD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "seed", 1m, "TWD" },
                    { "rate_seed_usd", "USD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "seed", 32.1m, "TWD" }
                });

            migrationBuilder.InsertData(
                table: "trips",
                columns: new[] { "TripId", "BaseCurrency", "CreatedAt", "CreatedBy", "IsArchived", "TripName", "UpdatedAt" },
                values: new object[] { "trip_default", "TWD", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Dustin", false, "東京五日遊", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });

            migrationBuilder.InsertData(
                table: "categories",
                columns: new[] { "CategoryId", "CategoryName", "CreatedAt", "Icon", "IsActive", "Note", "TripId" },
                values: new object[,]
                {
                    { "cat_1", "餐飲", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "🍜", true, "預設分類", "trip_default" },
                    { "cat_2", "早餐", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "🍳", true, "自訂分類", "trip_default" },
                    { "cat_3", "門票", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "🎟", true, "自訂分類", "trip_default" },
                    { "cat_4", "交通", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "🚆", true, "預設分類", "trip_default" },
                    { "cat_5", "住宿", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "🏨", true, "預設分類", "trip_default" },
                    { "cat_6", "購物", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "🛍", true, "預設分類", "trip_default" }
                });

            migrationBuilder.InsertData(
                table: "members",
                columns: new[] { "MemberId", "AvatarText", "CreatedAt", "EmailOrNote", "IsActive", "MemberName", "TripId" },
                values: new object[,]
                {
                    { "mem_1", "D", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "發起人", true, "Dustin", "trip_default" },
                    { "mem_2", "A", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "旅伴", true, "Amy", "trip_default" },
                    { "mem_3", "B", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "旅伴", true, "Ben", "trip_default" },
                    { "mem_4", "C", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "旅伴", true, "Cindy", "trip_default" }
                });

            migrationBuilder.InsertData(
                table: "payment_methods",
                columns: new[] { "PaymentMethodId", "CreatedAt", "Icon", "IsActive", "Note", "PaymentMethodName", "TripId" },
                values: new object[,]
                {
                    { "pay_1", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "💵", true, "預設方式", "現金", "trip_default" },
                    { "pay_2", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "💳", true, "信用卡", "Visa", "trip_default" },
                    { "pay_3", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "📱", true, "行動支付", "LINE Pay", "trip_default" },
                    { "pay_4", new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "🚇", true, "交通卡", "Suica", "trip_default" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_categories_TripId",
                table: "categories",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_expense_participants_ExpenseId",
                table: "expense_participants",
                column: "ExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_expense_receipts_ExpenseId",
                table: "expense_receipts",
                column: "ExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_expenses_TripId",
                table: "expenses",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_members_TripId",
                table: "members",
                column: "TripId");

            migrationBuilder.CreateIndex(
                name: "IX_payment_methods_TripId",
                table: "payment_methods",
                column: "TripId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "exchange_rates");

            migrationBuilder.DropTable(
                name: "expense_participants");

            migrationBuilder.DropTable(
                name: "expense_receipts");

            migrationBuilder.DropTable(
                name: "members");

            migrationBuilder.DropTable(
                name: "payment_methods");

            migrationBuilder.DropTable(
                name: "expenses");

            migrationBuilder.DropTable(
                name: "trips");
        }
    }
}
