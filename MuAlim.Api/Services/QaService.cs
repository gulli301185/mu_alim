using Microsoft.EntityFrameworkCore;
using MuAlim.Api.Data;
using MuAlim.Api.DTOs;
using MuAlim.Api.Models;

namespace MuAlim.Api.Services;

public interface IQaService
{
    Task<QaListResponse> GetListAsync(int page, int limit, string? search, QaSort sort, CancellationToken cancellationToken = default);
    Task<QaArticleDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
    Task<QaArticleDto?> CreateAsync(CreateQaRequest request, Guid? createdById, CancellationToken cancellationToken = default);
    Task<QaArticleDto?> UpdateAsync(Guid id, UpdateQaRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class QaService(MuAlimDbContext db) : IQaService
{
    private static QaArticleDto ToClient(QaArticle article, int? numberOverride = null)
    {
        var excerpt = article.Excerpt
            ?? (article.Answer.Length > 160
                ? $"{article.Answer[..160].Trim()}…"
                : article.Answer);

        return new QaArticleDto(
            Id: article.Slug,
            Slug: article.Slug,
            Number: numberOverride ?? article.QuestionNumber,
            Title: article.Question,
            Question: article.Question,
            Answer: article.Answer,
            Excerpt: excerpt,
            Tags: article.Tags,
            Views: article.Views,
            PublishedAt: article.PublishedAt.ToUniversalTime().ToString("O"),
            Type: article.Type,
            Source: "telegram");
    }

    public async Task<QaListResponse> GetListAsync(
        int page,
        int limit,
        string? search,
        QaSort sort,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        limit = Math.Clamp(limit, 1, 50);
        search = string.IsNullOrWhiteSpace(search) ? null : search.Trim();

        var query = db.QaArticles.AsNoTracking().Where(a => a.IsPublished);

        if (search is not null)
        {
            var lowerSearch = search.ToLowerInvariant();
            query = query.Where(a =>
                EF.Functions.ILike(a.Question, $"%{search}%")
                || EF.Functions.ILike(a.Answer, $"%{search}%")
                || a.Tags.Contains(lowerSearch));
        }

        query = sort switch
        {
            QaSort.Newest => query.OrderByDescending(a => a.PublishedAt),
            QaSort.Oldest => query.OrderBy(a => a.PublishedAt),
            QaSort.Popular => query.OrderByDescending(a => a.Views),
            _ => query
                .OrderBy(a => a.QuestionNumber == null)
                .ThenBy(a => a.QuestionNumber)
                .ThenByDescending(a => a.PublishedAt)
        };

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var dtos = items.Select((item, index) =>
        {
            var numberOverride = sort == QaSort.Default ? (int?)((page - 1) * limit + index + 1) : null;
            return ToClient(item, numberOverride);
        }).ToList();

        return new QaListResponse(
            dtos,
            total,
            page,
            Math.Max(1, (int)Math.Ceiling(total / (double)limit)));
    }

    public async Task<QaArticleDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        var article = await db.QaArticles
            .FirstOrDefaultAsync(a => a.Slug == slug && a.IsPublished, cancellationToken);

        if (article is null)
        {
            return null;
        }

        article.Views += 1;
        await db.SaveChangesAsync(cancellationToken);

        var rank = await db.QaArticles.CountAsync(a =>
            a.IsPublished && (
                a.PublishedAt < article.PublishedAt
                || (a.PublishedAt == article.PublishedAt && a.CreatedAt < article.CreatedAt)),
            cancellationToken);

        return ToClient(article, rank + 1);
    }

    public async Task<QaArticleDto?> CreateAsync(
        CreateQaRequest request,
        Guid? createdById,
        CancellationToken cancellationToken = default)
    {
        var slug = await SlugHelper.CreateUniqueSlugAsync(
            request.Question,
            async s => await db.QaArticles.AnyAsync(a => a.Slug == s, cancellationToken));

        var now = DateTime.UtcNow;
        var article = new QaArticle
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            QuestionNumber = request.Number,
            Question = request.Question,
            Answer = request.Answer,
            Tags = request.Tags ?? new List<string>(),
            Type = request.Type ?? QaArticleType.text,
            IsPublished = request.IsPublished ?? true,
            PublishedAt = request.PublishedAt ?? now,
            CreatedById = createdById,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.QaArticles.Add(article);
        await db.SaveChangesAsync(cancellationToken);

        return ToClient(article);
    }

    public async Task<QaArticleDto?> UpdateAsync(
        Guid id,
        UpdateQaRequest request,
        CancellationToken cancellationToken = default)
    {
        var article = await db.QaArticles.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (article is null)
        {
            return null;
        }

        if (request.Question is not null) article.Question = request.Question;
        if (request.Number is not null) article.QuestionNumber = request.Number;
        if (request.Answer is not null) article.Answer = request.Answer;
        if (request.Tags is not null) article.Tags = request.Tags;
        if (request.Type is not null) article.Type = request.Type.Value;
        if (request.IsPublished is not null) article.IsPublished = request.IsPublished.Value;
        if (request.PublishedAt is not null) article.PublishedAt = request.PublishedAt.Value;
        article.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return ToClient(article);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var article = await db.QaArticles.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
        if (article is null)
        {
            return false;
        }

        db.QaArticles.Remove(article);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
