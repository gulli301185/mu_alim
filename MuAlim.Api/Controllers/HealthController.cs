using Microsoft.AspNetCore.Mvc;
using MuAlim.Api.DTOs;

namespace MuAlim.Api.Controllers;

[ApiController]
[Route("api/health")]
[Produces("application/json")]
public class HealthController : ControllerBase
{
    /// <summary>API иштеп жатканын текшерүү</summary>
    [HttpGet]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get() => Ok(new HealthResponse(true));
}
