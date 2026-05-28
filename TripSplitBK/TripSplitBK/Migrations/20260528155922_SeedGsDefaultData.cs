using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TripSplitBK.Migrations
{
    /// <inheritdoc />
    public partial class SeedGsDefaultData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
IF NOT EXISTS (SELECT 1 FROM [trips] WHERE [TripId] = N'trip_default')
BEGIN
    INSERT INTO [trips] ([TripId], [TripName], [BaseCurrency], [CreatedBy], [CreatedAt], [UpdatedAt], [IsArchived])
    VALUES (N'trip_default', N'東京五日遊', N'TWD', N'Dustin', '2025-01-01T00:00:00.0000000Z', '2025-01-01T00:00:00.0000000Z', 0);
END

IF NOT EXISTS (SELECT 1 FROM [members] WHERE [MemberId] = N'mem_1')
BEGIN
    INSERT INTO [members] ([MemberId], [TripId], [MemberName], [EmailOrNote], [AvatarText], [CreatedAt], [IsActive])
    VALUES (N'mem_1', N'trip_default', N'Dustin', N'發起人', N'D', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [members] WHERE [MemberId] = N'mem_2')
BEGIN
    INSERT INTO [members] ([MemberId], [TripId], [MemberName], [EmailOrNote], [AvatarText], [CreatedAt], [IsActive])
    VALUES (N'mem_2', N'trip_default', N'Amy', N'旅伴', N'A', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [members] WHERE [MemberId] = N'mem_3')
BEGIN
    INSERT INTO [members] ([MemberId], [TripId], [MemberName], [EmailOrNote], [AvatarText], [CreatedAt], [IsActive])
    VALUES (N'mem_3', N'trip_default', N'Ben', N'旅伴', N'B', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [members] WHERE [MemberId] = N'mem_4')
BEGIN
    INSERT INTO [members] ([MemberId], [TripId], [MemberName], [EmailOrNote], [AvatarText], [CreatedAt], [IsActive])
    VALUES (N'mem_4', N'trip_default', N'Cindy', N'旅伴', N'C', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [categories] WHERE [CategoryId] = N'cat_1')
BEGIN
    INSERT INTO [categories] ([CategoryId], [TripId], [CategoryName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'cat_1', N'trip_default', N'餐飲', N'🍜', N'預設分類', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [categories] WHERE [CategoryId] = N'cat_2')
BEGIN
    INSERT INTO [categories] ([CategoryId], [TripId], [CategoryName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'cat_2', N'trip_default', N'早餐', N'🍳', N'自訂分類', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [categories] WHERE [CategoryId] = N'cat_3')
BEGIN
    INSERT INTO [categories] ([CategoryId], [TripId], [CategoryName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'cat_3', N'trip_default', N'門票', N'🎟', N'自訂分類', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [categories] WHERE [CategoryId] = N'cat_4')
BEGIN
    INSERT INTO [categories] ([CategoryId], [TripId], [CategoryName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'cat_4', N'trip_default', N'交通', N'🚆', N'預設分類', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [categories] WHERE [CategoryId] = N'cat_5')
BEGIN
    INSERT INTO [categories] ([CategoryId], [TripId], [CategoryName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'cat_5', N'trip_default', N'住宿', N'🏨', N'預設分類', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [categories] WHERE [CategoryId] = N'cat_6')
BEGIN
    INSERT INTO [categories] ([CategoryId], [TripId], [CategoryName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'cat_6', N'trip_default', N'購物', N'🛍', N'預設分類', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [payment_methods] WHERE [PaymentMethodId] = N'pay_1')
BEGIN
    INSERT INTO [payment_methods] ([PaymentMethodId], [TripId], [PaymentMethodName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'pay_1', N'trip_default', N'現金', N'💵', N'預設方式', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [payment_methods] WHERE [PaymentMethodId] = N'pay_2')
BEGIN
    INSERT INTO [payment_methods] ([PaymentMethodId], [TripId], [PaymentMethodName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'pay_2', N'trip_default', N'Visa', N'💳', N'信用卡', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [payment_methods] WHERE [PaymentMethodId] = N'pay_3')
BEGIN
    INSERT INTO [payment_methods] ([PaymentMethodId], [TripId], [PaymentMethodName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'pay_3', N'trip_default', N'LINE Pay', N'📱', N'行動支付', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [payment_methods] WHERE [PaymentMethodId] = N'pay_4')
BEGIN
    INSERT INTO [payment_methods] ([PaymentMethodId], [TripId], [PaymentMethodName], [Icon], [Note], [CreatedAt], [IsActive])
    VALUES (N'pay_4', N'trip_default', N'Suica', N'🚇', N'交通卡', '2025-01-01T00:00:00.0000000Z', 1);
END

IF NOT EXISTS (SELECT 1 FROM [exchange_rates] WHERE [RateId] = N'rate_seed_jpy')
BEGIN
    INSERT INTO [exchange_rates] ([RateId], [BaseCurrency], [TargetCurrency], [RateToTwd], [Provider], [FetchedAt])
    VALUES (N'rate_seed_jpy', N'JPY', N'TWD', 0.2185, N'seed', '2025-01-01T00:00:00.0000000Z');
END

IF NOT EXISTS (SELECT 1 FROM [exchange_rates] WHERE [RateId] = N'rate_seed_usd')
BEGIN
    INSERT INTO [exchange_rates] ([RateId], [BaseCurrency], [TargetCurrency], [RateToTwd], [Provider], [FetchedAt])
    VALUES (N'rate_seed_usd', N'USD', N'TWD', 32.1, N'seed', '2025-01-01T00:00:00.0000000Z');
END

IF NOT EXISTS (SELECT 1 FROM [exchange_rates] WHERE [RateId] = N'rate_seed_krw')
BEGIN
    INSERT INTO [exchange_rates] ([RateId], [BaseCurrency], [TargetCurrency], [RateToTwd], [Provider], [FetchedAt])
    VALUES (N'rate_seed_krw', N'KRW', N'TWD', 0.0235, N'seed', '2025-01-01T00:00:00.0000000Z');
END

IF NOT EXISTS (SELECT 1 FROM [exchange_rates] WHERE [RateId] = N'rate_seed_eur')
BEGIN
    INSERT INTO [exchange_rates] ([RateId], [BaseCurrency], [TargetCurrency], [RateToTwd], [Provider], [FetchedAt])
    VALUES (N'rate_seed_eur', N'EUR', N'TWD', 34.8, N'seed', '2025-01-01T00:00:00.0000000Z');
END

IF NOT EXISTS (SELECT 1 FROM [exchange_rates] WHERE [RateId] = N'rate_seed_thb')
BEGIN
    INSERT INTO [exchange_rates] ([RateId], [BaseCurrency], [TargetCurrency], [RateToTwd], [Provider], [FetchedAt])
    VALUES (N'rate_seed_thb', N'THB', N'TWD', 0.88, N'seed', '2025-01-01T00:00:00.0000000Z');
END

IF NOT EXISTS (SELECT 1 FROM [exchange_rates] WHERE [RateId] = N'rate_seed_twd')
BEGIN
    INSERT INTO [exchange_rates] ([RateId], [BaseCurrency], [TargetCurrency], [RateToTwd], [Provider], [FetchedAt])
    VALUES (N'rate_seed_twd', N'TWD', N'TWD', 1, N'seed', '2025-01-01T00:00:00.0000000Z');
END
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "categories",
                keyColumn: "CategoryId",
                keyValue: "cat_1");

            migrationBuilder.DeleteData(
                table: "categories",
                keyColumn: "CategoryId",
                keyValue: "cat_2");

            migrationBuilder.DeleteData(
                table: "categories",
                keyColumn: "CategoryId",
                keyValue: "cat_3");

            migrationBuilder.DeleteData(
                table: "categories",
                keyColumn: "CategoryId",
                keyValue: "cat_4");

            migrationBuilder.DeleteData(
                table: "categories",
                keyColumn: "CategoryId",
                keyValue: "cat_5");

            migrationBuilder.DeleteData(
                table: "categories",
                keyColumn: "CategoryId",
                keyValue: "cat_6");

            migrationBuilder.DeleteData(
                table: "exchange_rates",
                keyColumn: "RateId",
                keyValue: "rate_seed_eur");

            migrationBuilder.DeleteData(
                table: "exchange_rates",
                keyColumn: "RateId",
                keyValue: "rate_seed_jpy");

            migrationBuilder.DeleteData(
                table: "exchange_rates",
                keyColumn: "RateId",
                keyValue: "rate_seed_krw");

            migrationBuilder.DeleteData(
                table: "exchange_rates",
                keyColumn: "RateId",
                keyValue: "rate_seed_thb");

            migrationBuilder.DeleteData(
                table: "exchange_rates",
                keyColumn: "RateId",
                keyValue: "rate_seed_twd");

            migrationBuilder.DeleteData(
                table: "exchange_rates",
                keyColumn: "RateId",
                keyValue: "rate_seed_usd");

            migrationBuilder.DeleteData(
                table: "members",
                keyColumn: "MemberId",
                keyValue: "mem_1");

            migrationBuilder.DeleteData(
                table: "members",
                keyColumn: "MemberId",
                keyValue: "mem_2");

            migrationBuilder.DeleteData(
                table: "members",
                keyColumn: "MemberId",
                keyValue: "mem_3");

            migrationBuilder.DeleteData(
                table: "members",
                keyColumn: "MemberId",
                keyValue: "mem_4");

            migrationBuilder.DeleteData(
                table: "payment_methods",
                keyColumn: "PaymentMethodId",
                keyValue: "pay_1");

            migrationBuilder.DeleteData(
                table: "payment_methods",
                keyColumn: "PaymentMethodId",
                keyValue: "pay_2");

            migrationBuilder.DeleteData(
                table: "payment_methods",
                keyColumn: "PaymentMethodId",
                keyValue: "pay_3");

            migrationBuilder.DeleteData(
                table: "payment_methods",
                keyColumn: "PaymentMethodId",
                keyValue: "pay_4");

            migrationBuilder.DeleteData(
                table: "trips",
                keyColumn: "TripId",
                keyValue: "trip_default");
        }
    }
}
