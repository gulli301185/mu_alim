namespace MuAlim.Api.Models;

public class QaArticle
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public int? QuestionNumber { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string? Excerpt { get; set; }
    public List<string> Tags { get; set; } = new();
    public QaArticleType Type { get; set; } = QaArticleType.text;
    public int Views { get; set; }
    public bool IsPublished { get; set; } = true;
    public DateTime PublishedAt { get; set; }
    public Guid? CreatedById { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User? CreatedBy { get; set; }
}
