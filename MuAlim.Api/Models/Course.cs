namespace MuAlim.Api.Models;

public class Course
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public bool IsPublished { get; set; }

    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
}
