using Microsoft.EntityFrameworkCore;
using MuAlim.Api.Data;
using MuAlim.Api.DTOs;
using MuAlim.Api.Models;

namespace MuAlim.Api.Services;

public interface ILessonService
{
    Task<IReadOnlyList<LessonDto>?> GetByCourseAsync(string courseId, bool includeUnpublished, CancellationToken cancellationToken = default);
    Task<(LessonDto? Lesson, string? Error)> CreateAsync(string courseId, CreateLessonDto request, CancellationToken cancellationToken = default);
    Task<(LessonDto? Lesson, string? Error)> UpdateAsync(Guid id, UpdateLessonDto request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class LessonService(MuAlimDbContext db) : ILessonService
{
    private static LessonDto ToDto(Lesson lesson) => new(
        lesson.Id,
        lesson.Title,
        lesson.Description,
        lesson.YoutubeVideoId,
        lesson.DurationSeconds,
        lesson.LessonOrder,
        lesson.IsPublished);

    private async Task<Course?> ResolveCourseAsync(string courseId, CancellationToken cancellationToken)
    {
        if (Guid.TryParse(courseId, out var courseGuid))
        {
            return await db.Courses.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == courseGuid, cancellationToken);
        }

        return await db.Courses.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Slug == courseId, cancellationToken);
    }

    private async Task<Course?> ResolveCourseTrackedAsync(string courseId, CancellationToken cancellationToken)
    {
        if (Guid.TryParse(courseId, out var courseGuid))
        {
            return await db.Courses.FirstOrDefaultAsync(c => c.Id == courseGuid, cancellationToken);
        }

        return await db.Courses.FirstOrDefaultAsync(c => c.Slug == courseId, cancellationToken);
    }

    private Task<bool> LessonOrderTakenAsync(
        Guid courseId,
        int lessonOrder,
        Guid? excludeLessonId,
        CancellationToken cancellationToken) =>
        db.Lessons.AnyAsync(
            l => l.CourseId == courseId
                && l.LessonOrder == lessonOrder
                && (excludeLessonId == null || l.Id != excludeLessonId),
            cancellationToken);

    public async Task<IReadOnlyList<LessonDto>?> GetByCourseAsync(
        string courseId,
        bool includeUnpublished,
        CancellationToken cancellationToken = default)
    {
        var course = await ResolveCourseAsync(courseId, cancellationToken);
        if (course is null)
        {
            return null;
        }

        var query = db.Lessons.AsNoTracking().Where(l => l.CourseId == course.Id);
        if (!includeUnpublished)
        {
            query = query.Where(l => l.IsPublished);
        }

        var lessons = await query
            .OrderBy(l => l.LessonOrder)
            .ToListAsync(cancellationToken);

        return lessons.Select(ToDto).ToList();
    }

    public async Task<(LessonDto? Lesson, string? Error)> CreateAsync(
        string courseId,
        CreateLessonDto request,
        CancellationToken cancellationToken = default)
    {
        var course = await ResolveCourseTrackedAsync(courseId, cancellationToken);
        if (course is null)
        {
            return (null, "Курс табылган жок");
        }

        var videoId = YoutubeHelper.ParseVideoId(request.YoutubeUrl);
        if (videoId is null)
        {
            return (null, "YouTube шилтемеси туура эмес");
        }

        if (await LessonOrderTakenAsync(course.Id, request.LessonOrder, null, cancellationToken))
        {
            return (null, "Бул сабак номери бу курс үчүн эле колдонулган");
        }

        var now = DateTime.UtcNow;
        var lesson = new Lesson
        {
            Id = Guid.NewGuid(),
            CourseId = course.Id,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            YoutubeUrl = request.YoutubeUrl.Trim(),
            YoutubeVideoId = videoId,
            DurationSeconds = request.DurationSeconds,
            LessonOrder = request.LessonOrder,
            IsPublished = request.IsPublished,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Lessons.Add(lesson);
        await db.SaveChangesAsync(cancellationToken);

        return (ToDto(lesson), null);
    }

    public async Task<(LessonDto? Lesson, string? Error)> UpdateAsync(
        Guid id,
        UpdateLessonDto request,
        CancellationToken cancellationToken = default)
    {
        var lesson = await db.Lessons.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (lesson is null)
        {
            return (null, "Сабак табылган жок");
        }

        if (request.Title is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return (null, "Сабактын аталышы бош болбошу керек");
            }

            lesson.Title = request.Title.Trim();
        }

        if (request.Description is not null)
        {
            lesson.Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim();
        }

        if (request.YoutubeUrl is not null)
        {
            var videoId = YoutubeHelper.ParseVideoId(request.YoutubeUrl);
            if (videoId is null)
            {
                return (null, "YouTube шилтемеси туура эмес");
            }

            lesson.YoutubeUrl = request.YoutubeUrl.Trim();
            lesson.YoutubeVideoId = videoId;
        }

        if (request.DurationSeconds is not null)
        {
            lesson.DurationSeconds = request.DurationSeconds;
        }

        if (request.LessonOrder is not null)
        {
            if (await LessonOrderTakenAsync(lesson.CourseId, request.LessonOrder.Value, lesson.Id, cancellationToken))
            {
                return (null, "Бул сабак номери бу курс үчүн эле колдонулган");
            }

            lesson.LessonOrder = request.LessonOrder.Value;
        }

        if (request.IsPublished is not null)
        {
            lesson.IsPublished = request.IsPublished.Value;
        }

        lesson.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return (ToDto(lesson), null);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var lesson = await db.Lessons.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (lesson is null)
        {
            return false;
        }

        db.Lessons.Remove(lesson);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
