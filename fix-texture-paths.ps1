# Batch fix texture paths script
# Create correct directory structures and copy texture files for all models

Write-Host "Starting batch texture path fix..."
Write-Host "=" * 50

# Define root directory
$rootDir = "e:\mdx-m3-viewer-master\src\model"

# Get all race directories
$raceDirs = Get-ChildItem -Path $rootDir -Directory

# Process each race
foreach ($race in $raceDirs) {
    $raceName = $race.Name
    Write-Host "Processing race: $raceName"
    Write-Host "-" * 40
    
    # Get all model directories for this race
    $modelDirs = Get-ChildItem -Path $race.FullName -Directory
    
    # Process each model
    foreach ($model in $modelDirs) {
        $modelName = $model.Name
        
        # Check for .blp texture files
        $textureFiles = Get-ChildItem -Path $model.FullName -Filter "*.blp" -File
        
        if ($textureFiles.Count -gt 0) {
            Write-Host "Processing model: $modelName"
            
            # Create target directory structure
            $targetDir = "$($model.FullName)\units\$raceName\$modelName"
            
            # Create directory structure
            New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
            Write-Host "  Created directory: $targetDir"
            
            # Copy all .blp files to target directory
            foreach ($textureFile in $textureFiles) {
                $targetFilePath = "$targetDir\$($textureFile.Name)"
                Copy-Item -Path $textureFile.FullName -Destination $targetFilePath -Force
                Write-Host "  Copied texture: $($textureFile.Name)"
            }
            
            Write-Host "  Completed: $modelName"
        }
    }
    
    Write-Host ""
}

Write-Host "=" * 50
Write-Host "Batch texture path fix completed!"
Write-Host "All model texture files have been copied to the correct directory structure."
