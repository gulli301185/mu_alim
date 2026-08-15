using Microsoft.AspNetCore.Authorization;

namespace MuAlim.Api.Authorization;

public class AdminRequirement : IAuthorizationRequirement;

public class AdminAuthorizationHandler : AuthorizationHandler<AdminRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AdminRequirement requirement)
    {
        var role = context.User.FindFirst("role")?.Value;
        if (role == "admin")
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
