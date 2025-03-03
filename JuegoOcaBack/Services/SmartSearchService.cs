using F23.StringSimilarity;
using F23.StringSimilarity.Interfaces;
using System.Globalization;
using System.Text;

namespace JuegoOcaBack.Services
{
    public class SmartSearchService
    {

        private const double THRESHOLD = 0.75;
        private static readonly string[] ITEMS = [
        "Paco",
        ];

        private readonly INormalizedStringSimilarity _stringSimilarityComparer;

        public SmartSearchService()
        {
            _stringSimilarityComparer = new JaroWinkler();
        }

        public IEnumerable<string> Search(string query)
        {
            IEnumerable<string> result;

            if (string.IsNullOrWhiteSpace(query))
            {
                result = ITEMS;
            }
            else
            {
                string[] queryKeys = GetKeys(ClearText(query));
                List<string> matches = new List<string>();

                foreach (string item in ITEMS)
                {
                    // Separamos por espacios
                    string[] itemKeys = GetKeys(ClearText(item));

                    // Si coincide alguna de las palabras de item con las de query
                    // entonces añadimos item a la lista de coincidencias
                    if (IsMatch(queryKeys, itemKeys))
                    {
                        matches.Add(item);
                    }
                }

                result = matches;
            }

            return result;
        }

        //Metodo para ver si hay match (tinder ahh method)
        private bool IsMatch(string[] queryKeys, string[] itemKeys)
        {
            bool isMatch = false;

            for (int i = 0; !isMatch && i < itemKeys.Length; i++)
            {
                string itemKey = itemKeys[i];

                for (int j = 0; !isMatch && j < queryKeys.Length; j++)
                {
                    string queryKey = queryKeys[j];

                    isMatch = IsMatch(itemKey, queryKey);
                }
            }

            return isMatch;
        }

        // Hay coincidencia si las palabras son las mismas o si item contiene query o si son similares
        private bool IsMatch(string itemKey, string queryKey)
        {
            return itemKey == queryKey
                || itemKey.Contains(queryKey)
                || _stringSimilarityComparer.Similarity(itemKey, queryKey) >= THRESHOLD;
        }


        private string[] GetKeys(string query)
        {
            return query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        private string ClearText(string text)
        {
            return RemoveDiacritics(text.ToLower());
        }

        // Quita tildes
        private string RemoveDiacritics(string text)
        {
            string normalizedString = text.Normalize(NormalizationForm.FormD);
            StringBuilder stringBuilder = new StringBuilder(normalizedString.Length);

            for (int i = 0; i < normalizedString.Length; i++)
            {
                char c = normalizedString[i];
                UnicodeCategory unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                {
                    stringBuilder.Append(c);
                }
            }

            return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
        }
    }
}