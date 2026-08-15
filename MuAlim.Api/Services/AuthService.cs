using Microsoft.EntityFrameworkCore;
using MuAlim.Api.Data;
using MuAlim.Api.DTOs;

namespace MuAlim.Api.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
}

public class AuthService(MuAlimDbContext db, ITokenService tokenService) : IAuthService
{
    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken);

        if (user is null || !user.IsActive)
        {
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return null;
        }

        await db.Users
            .Where(u => u.Id == user.Id)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(u => u.LastLoginAt, DateTime.UtcNow),
                cancellationToken);

        return new LoginResponse(
            tokenService.CreateToken(user),
            new UserDto(user.Id, user.Email, user.FirstName, user.LastName, user.Role));
    }
}
