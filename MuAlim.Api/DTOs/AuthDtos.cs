using System.ComponentModel.DataAnnotations;
using MuAlim.Api.Models;

namespace MuAlim.Api.DTOs;

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(6)] string Password);

public record UserDto(
    Guid Id,
    string Email,
    string FirstName,
    string LastName,
    UserRole Role);

public record LoginResponse(string Token, UserDto User);

public record ErrorResponse(string Error);
