using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;

namespace MuAlim.Api.Services;

public static partial class YoutubeHelper
{
    public static string? ParseVideoId(string input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        var trimmed = input.Trim();
        if (VideoIdRegex().IsMatch(trimmed))
        {
            return trimmed;
        }

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            return null;
        }

        if (uri.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase))
        {
            var id = uri.AbsolutePath.TrimStart('/').Split('/')[0];
            return string.IsNullOrEmpty(id) ? null : id;
        }

        if (uri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase)
            || uri.Host.Contains("youtube-nocookie.com", StringComparison.OrdinalIgnoreCase))
        {
            var query = QueryHelpers.ParseQuery(uri.Query);
            if (query.TryGetValue("v", out var videoParam) && !string.IsNullOrWhiteSpace(videoParam))
            {
                return videoParam.ToString();
            }

            var parts = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var embedIndex = Array.IndexOf(parts, "embed");
            if (embedIndex >= 0 && embedIndex + 1 < parts.Length)
            {
                return parts[embedIndex + 1];
            }

            var videoIndex = Array.IndexOf(parts, "video");
            if (videoIndex >= 0 && videoIndex + 1 < parts.Length)
            {
                return parts[videoIndex + 1];
            }
        }

        return null;
    }

    [GeneratedRegex(@"^[\w-]{11}$")]
    private static partial Regex VideoIdRegex();
}
