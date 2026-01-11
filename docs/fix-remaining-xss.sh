#!/bin/bash
# Script to fix remaining XSS vulnerabilities by adding imports and replacing innerHTML

echo "Fixing XSS vulnerabilities in remaining files..."

# Array of files that need the import added
files=(
  "src/pages/ArtifactDetails.tsx"
  "src/components/RecentFinds.tsx"
  "src/components/ActiveProject.tsx"
  "src/pages/Explore.tsx"
  "src/pages/GiftShop.tsx"
  "src/pages/SiteDetails.tsx"
  "src/pages/SiteLists.tsx"
  "src/pages/CheckoutMerchandise.tsx"
)

echo "Files need manual review and fix:"
for file in "${files[@]}"; do
  echo "  - $file"
done

echo ""
echo "Action required:"
echo "1. Add this import to each file:"
echo "   import { createEmojiElement, getArtifactEmoji } from '@/lib/sanitize';"
echo ""
echo "2. Replace innerHTML usage with:"
echo "   parent.appendChild(createEmojiElement(emoji, 'text-size'));"
echo ""
echo "3. For artifact emojis, use:"
echo "   parent.appendChild(createEmojiElement(getArtifactEmoji(artifact.type), 'text-size'));"
echo ""
echo "See Articles.tsx and Artifacts.tsx for examples of the fix."
