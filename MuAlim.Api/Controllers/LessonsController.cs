using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MuAlim.Api.DTOs;
using MuAlim.Api.Services;

namespace MuAlim.Api.Controllers;

[ApiController]
[Route("api")]
[Produces("application/json")]
public class LessonsController(ILessonService lessonService) : ControllerBase
{
    /// <summary>Курс боюнча сабактар (жарыяланган гана)</summary>
    [HttpGet("courses/{courseId}/lessons")]
    [ProducesResponseType(typeof(IReadOnlyList<LessonDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<LessonDto>>> GetByCourse(
        string courseId,
        CancellationToken cancellationToken)
    {
        var lessons = await lessonService.GetByCourseAsync(courseId, includeUnpublished: false, cancellationToken);
        if (lessons is null)
        {
            return NotFound(new ErrorResponse("Курс табылган жок"));
        }

        return Ok(lessons);
    }

    /// <summary>Жаңы сабак кошуу (admin)</summary>
    [HttpPost("courses/{courseId}/lessons")]
    [Authorize(Policy = "Admin")]
    [ProducesResponseType(typeof(LessonDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<LessonDto>> Create(
        string courseId,
        [FromBody] CreateLessonDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new ErrorResponse("Маалымат туура эмес"));
        }

        var (lesson, error) = await lessonService.CreateAsync(courseId, request, cancellationToken);
        if (error == "Курс табылган жок")
        {
            return NotFound(new ErrorResponse(error));
        }

        if (error is not null)
        {
            return BadRequest(new ErrorResponse(error));
        }

        return CreatedAtAction(nameof(GetByCourse), new { courseId }, lesson);
    }

    /// <summary>Сабакты жаңыртуу (admin)</summary>
    [HttpPut("lessons/{id:guid}")]
    [Authorize(Policy = "Admin")]
    [ProducesResponseType(typeof(LessonDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<LessonDto>> Update(
        Guid id,
        [FromBody] UpdateLessonDto request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new ErrorResponse("Маалымат туура эмес"));
        }

        var (lesson, error) = await lessonService.UpdateAsync(id, request, cancellationToken);
        if (error == "Сабак табылган жок")
        {
            return NotFound(new ErrorResponse(error));
        }

        if (error is not null)
        {
            return BadRequest(new ErrorResponse(error));
        }

        return Ok(lesson);
    }

    /// <summary>Сабакты өчүрүү (admin)</summary>
    [HttpDelete("lessons/{id:guid}")]
    [Authorize(Policy = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await lessonService.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound(new ErrorResponse("Сабак табылган жок"));
        }

        return NoContent();
    }
}
