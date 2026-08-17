using System.ComponentModel.DataAnnotations;

namespace MuAlim.Api.DTOs;

public record LessonDto(
    Guid Id,
    string Title,
    string? Description,
    string YoutubeVideoId,
    int? DurationSeconds,
    int LessonOrder,
    bool IsPublished);

public record CreateLessonDto(
    [Required, MinLength(1), MaxLength(255)] string Title,
    string? Description,
    [Required, MinLength(1), MaxLength(500)] string YoutubeUrl,
    int? DurationSeconds,
    [Required, Range(1, int.MaxValue)] int LessonOrder,
    bool IsPublished = false);

public record UpdateLessonDto(
    [MaxLength(255)] string? Title = null,
    string? Description = null,
    [MaxLength(500)] string? YoutubeUrl = null,
    int? DurationSeconds = null,
    [Range(1, int.MaxValue)] int? LessonOrder = null,
    bool? IsPublished = null);
