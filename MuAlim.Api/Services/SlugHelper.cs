using System.Text.RegularExpressions;

namespace MuAlim.Api.Services;

public static class SlugHelper
{
    public static string Slugify(string text)
    {
        var normalized = text.Trim().ToLowerInvariant();
        normalized = Regex.Replace(normalized, @"[^\w\s-]", string.Empty);
        normalized = Regex.Replace(normalized, @"[\s_-]+", "-");
        normalized = normalized.Trim('-');
        return string.IsNullOrWhiteSpace(normalized) ? "article" : normalized;
    }

    public static async Task<string> CreateUniqueSlugAsync(
        string text,
        Func<string, Task<bool>> existsAsync)
    {
        var baseSlug = Slugify(text);
        var slug = baseSlug;
        var counter = 2;

        while (await existsAsync(slug))
        {
            slug = $"{baseSlug}-{counter}";
            counter++;
        }

        return slug;
    }
}
