using Microsoft.EntityFrameworkCore;
using TripSplitBK.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();

builder.Services.AddDbContext<TripSplitDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// 先全部開放 CORS，測試用
builder.Services.AddCors(options =>
{
    options.AddPolicy("TripSplitCors", policy =>
    {
        policy
            .SetIsOriginAllowed(origin => true)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// Auto migrate on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TripSplitDbContext>();
    db.Database.Migrate();
}

app.UseSwagger();
app.UseSwaggerUI();

// 後端沒有 HTTPS，先不要開這行
// app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.UseCors("TripSplitCors");

app.UseAuthorization();

app.MapControllers()
   .RequireCors("TripSplitCors");

app.MapGet("/api/ping", () => Results.Ok(new
{
    ok = true,
    message = "TripSplit API is running.",
    time = DateTime.UtcNow
}))
.RequireCors("TripSplitCors");

app.Run();