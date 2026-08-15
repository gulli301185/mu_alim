using System.ComponentModel.DataAnnotations;
using MuAlim.Api.Models;

namespace MuAlim.Api.DTOs;

public record QaArticleDto(
    string Id,
    string Slug,
    int? Number,
    string Title,
    string Question,
    string Answer,
    string Excerpt,
    IReadOnlyList<string> Tags,
    int Views,
    string PublishedAt,
    QaArticleType Type,
    string Source);

public record QaListResponse(
    IReadOnlyList<QaArticleDto> Items,
    int Total,
    int Page,
    int TotalPages);

public record CreateQaRequest(
    [Required, MinLength(3)] string Question,
    [Required, MinLength(1)] string Answer,
    int? Number = null,
    List<string>? Tags = null,
    QaArticleType? Type = null,
    bool? IsPublished = null,
    DateTime? PublishedAt = null);

public record UpdateQaRequest(
    string? Question = null,
    string? Answer = null,
    int? Number = null,
    List<string>? Tags = null,
    QaArticleType? Type = null,
    bool? IsPublished = null,
    DateTime? PublishedAt = null);

public enum QaSort
{
    Default,
    Newest,
    Oldest,
    Popular
}
