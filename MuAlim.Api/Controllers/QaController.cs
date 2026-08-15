using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MuAlim.Api.DTOs;
using MuAlim.Api.Extensions;
using MuAlim.Api.Services;

namespace MuAlim.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class QaController(IQaService qaService) : ControllerBase
{
    /// <summary>Суроо-жооп тизмеси (page, limit, search, sort)</summary>
    [HttpGet]
    [ProducesResponseType(typeof(QaListResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<QaListResponse>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 10,
        [FromQuery] string? search = null,
        [FromQuery] string sort = "default",
        CancellationToken cancellationToken = default)
    {
        var sortValue = sort.ToLowerInvariant() switch
        {
            "newest" => QaSort.Newest,
            "oldest" => QaSort.Oldest,
            "popular" => QaSort.Popular,
            _ => QaSort.Default
        };

        var result = await qaService.GetListAsync(page, limit, search, sortValue, cancellationToken);
        return Ok(result);
    }

    /// <summary>Бир суроо-жоопту slug боюнча алуу (views +1)</summary>
    [HttpGet("{slug}")]
    [ProducesResponseType(typeof(QaArticleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<QaArticleDto>> GetBySlug(string slug, CancellationToken cancellationToken)
    {
        var article = await qaService.GetBySlugAsync(slug, cancellationToken);
        if (article is null)
        {
            return NotFound(new ErrorResponse("Суроо табылган жок"));
        }

        return Ok(article);
    }

    /// <summary>Жаңы суроо-жооп түзүү (admin)</summary>
    [HttpPost]
    [Authorize(Policy = "Admin")]
    [ProducesResponseType(typeof(QaArticleDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<QaArticleDto>> Create(
        [FromBody] CreateQaRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new ErrorResponse("Маалымат туура эмес"));
        }

        var article = await qaService.CreateAsync(request, this.GetUserId(), cancellationToken);
        return CreatedAtAction(nameof(GetBySlug), new { slug = article!.Slug }, article);
    }

    /// <summary>Суроо-жоопту жаңыртуу (admin)</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Admin")]
    [ProducesResponseType(typeof(QaArticleDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<QaArticleDto>> Update(
        Guid id,
        [FromBody] UpdateQaRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new ErrorResponse("Маалымат туура эмес"));
        }

        var article = await qaService.UpdateAsync(id, request, cancellationToken);
        if (article is null)
        {
            return NotFound(new ErrorResponse("Суроо табылган жок"));
        }

        return Ok(article);
    }

    /// <summary>Суроо-жоопту өчүрүү (admin)</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await qaService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound(new ErrorResponse("Суроо табылган жок"));
        }

        return NoContent();
    }
}
