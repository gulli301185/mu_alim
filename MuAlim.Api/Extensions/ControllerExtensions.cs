using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace MuAlim.Api.Extensions;

public static class ControllerExtensions
{
    public static Guid? GetUserId(this ControllerBase controller)
    {
        var id = controller.User.FindFirstValue("id");
        return Guid.TryParse(id, out var guid) ? guid : null;
    }
}
