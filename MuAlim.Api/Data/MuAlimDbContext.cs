using Microsoft.EntityFrameworkCore;
using MuAlim.Api.Models;

namespace MuAlim.Api.Data;

public class MuAlimDbContext(DbContextOptions<MuAlimDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<QaArticle> QaArticles => Set<QaArticle>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Lesson> Lessons => Set<Lesson>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresEnum<UserRole>("user_role");
        modelBuilder.HasPostgresEnum<QaArticleType>("qa_article_type");

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(255);
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
            entity.Property(e => e.FirstName).HasColumnName("first_name").HasMaxLength(100);
            entity.Property(e => e.LastName).HasColumnName("last_name").HasMaxLength(100);
            entity.Property(e => e.Phone).HasColumnName("phone").HasMaxLength(30);
            entity.Property(e => e.Role).HasColumnName("role");
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.IsVerified).HasColumnName("is_verified");
            entity.Property(e => e.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => e.Email).IsUnique();
        });

        modelBuilder.Entity<QaArticle>(entity =>
        {
            entity.ToTable("qa_articles");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Slug).HasColumnName("slug").HasMaxLength(280);
            entity.Property(e => e.QuestionNumber).HasColumnName("question_number");
            entity.Property(e => e.Question).HasColumnName("question");
            entity.Property(e => e.Answer).HasColumnName("answer");
            entity.Property(e => e.Excerpt).HasColumnName("excerpt").HasMaxLength(500);
            entity.Property(e => e.Tags).HasColumnName("tags");
            entity.Property(e => e.Type).HasColumnName("type");
            entity.Property(e => e.Views).HasColumnName("views");
            entity.Property(e => e.IsPublished).HasColumnName("is_published");
            entity.Property(e => e.PublishedAt).HasColumnName("published_at");
            entity.Property(e => e.CreatedById).HasColumnName("created_by_id");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasOne(e => e.CreatedBy)
                .WithMany(u => u.QaArticles)
                .HasForeignKey(e => e.CreatedById)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Course>(entity =>
        {
            entity.ToTable("courses");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Slug).HasColumnName("slug").HasMaxLength(280);
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(255);
            entity.Property(e => e.IsPublished).HasColumnName("is_published");
            entity.HasIndex(e => e.Slug).IsUnique();
        });

        modelBuilder.Entity<Lesson>(entity =>
        {
            entity.ToTable("lessons");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CourseId).HasColumnName("course_id");
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(255);
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.YoutubeUrl).HasColumnName("youtube_url").HasMaxLength(500);
            entity.Property(e => e.YoutubeVideoId).HasColumnName("youtube_video_id").HasMaxLength(50);
            entity.Property(e => e.DurationSeconds).HasColumnName("duration_seconds");
            entity.Property(e => e.LessonOrder).HasColumnName("lesson_order");
            entity.Property(e => e.IsPublished).HasColumnName("is_published");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => new { e.CourseId, e.LessonOrder }).IsUnique();
            entity.HasOne(e => e.Course)
                .WithMany(c => c.Lessons)
                .HasForeignKey(e => e.CourseId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
