namespace MuAlim.Api.Models;

public class Lesson
{
    public Guid Id { get; set; }
    public Guid CourseId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string YoutubeUrl { get; set; } = string.Empty;
    public string YoutubeVideoId { get; set; } = string.Empty;
    public int? DurationSeconds { get; set; }
    public int LessonOrder { get; set; }
    public bool IsPublished { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Course Course { get; set; } = null!;
}
