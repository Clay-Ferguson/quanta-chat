import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { svrUtil } from "../../ServerUtil.js";
import { config } from "../../Config.js";
import { docUtil } from "./DocUtil.js";

/**
 * DocMod - Document Modification Service
 * 
 * This class provides comprehensive file and folder management operations for the document tree viewer feature.
 * It handles CRUD operations on files and folders within a secure, sandboxed environment with proper access controls.
 * 
 * Key Features:
 * - File operations: save, rename, delete, move up/down in order
 * - Folder operations: create, rename, delete, convert file to folder
 * - Batch operations: multi-file deletion, cut/paste with ordinal positioning
 * - Content manipulation: file splitting on delimiters, joining multiple files
 * - Ordinal management: maintains numeric prefixes for ordered file/folder display
 * 
 * Security:
 * - All file operations are validated against the configured document root
 * - Path traversal attacks are prevented through docUtil.checkFileAccess()
 * - Operations are limited to configured public folders only
 * 
 * File Naming Convention:
 * - Files and folders use numeric prefixes (e.g., "0001_filename.md")
 * - Ordinals are automatically managed when items are moved or inserted
 * - Supports automatic .md extension addition for files without extensions
 */
class DocMod {
    /**
     * Saves file content to the server for the tree viewer feature
     * 
     * This method handles both simple file saving and advanced content splitting functionality.
     * When the split option is enabled, content can be divided at '\n~\n' delimiters to create
     * multiple files with proper ordinal sequencing.
     * 
     * Features:
     * - Automatic .md extension addition for files without extensions
     * - File renaming support during save operation
     * - Content splitting on '\n~\n' delimiter with ordinal management
     * - Proper ordinal shifting for existing files when splitting
     * - Security validation for all file operations
     * 
     * @param req - Express request object containing:
     *   - filename: string - Name of the file to save
     *   - content: string - File content to save
     *   - treeFolder: string - Relative path to the target folder
     *   - newFileName?: string - Optional new name for the file (triggers rename)
     *   - docRootKey?: string - Key identifying the document root configuration
     *   - split?: boolean - Whether to split content on '\n~\n' delimiter
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    saveFile = async (req: Request<any, any, { filename: string; content: string; treeFolder: string; newFileName?: string, docRootKey?: string, split?: boolean }>, res: Response): Promise<void> => {
        try {
            // Extract request parameters
            const { filename, content, treeFolder, docRootKey, split } = req.body;
            let { newFileName } = req.body;
    
            // Ensure new filenames have proper .md extension if not specified
            if (newFileName && !path.extname(newFileName)) {
                newFileName += '.md';
            }
    
            // Validate document root configuration
            const root = config.getPublicFolderByKey(docRootKey!).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }
    
            // Validate required parameters
            if (!filename || content === undefined || !treeFolder) {
                res.status(400).json({ error: 'Filename, content, and treeFolder are required' });
                return;
            }
    
            // Construct absolute paths for file operations
            const absoluteFolderPath = path.join(root, treeFolder);
            const absoluteFilePath = path.join(absoluteFolderPath, filename);
    
            // Verify target directory exists and is accessible
            docUtil.checkFileAccess(absoluteFolderPath, root); 
            if (!fs.existsSync(absoluteFolderPath)) {
                res.status(404).json({ error: 'Directory not found' });
                return;
            }
    
            // Ensure the target path is actually a directory
            const stat = fs.statSync(absoluteFolderPath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }
    
            let finalFilePath = absoluteFilePath;
    
            // Handle file renaming if a new filename is provided
            if (newFileName && newFileName !== filename) {
                const newAbsoluteFilePath = path.join(absoluteFolderPath, newFileName);
                    
                // Verify the original file exists before attempting rename
                if (fs.existsSync(absoluteFilePath)) {
                    // Prevent overwriting existing files
                    if (fs.existsSync(newAbsoluteFilePath)) {
                        res.status(409).json({ error: 'A file with the new name already exists' });
                        return;
                    }
                        
                    // Perform the file rename operation with security check
                    docUtil.checkFileAccess(absoluteFilePath, root);
                    fs.renameSync(absoluteFilePath, newAbsoluteFilePath);
                    console.log(`File renamed successfully: ${absoluteFilePath} -> ${newAbsoluteFilePath}`);
                }
                    
                // Update the target file path for subsequent operations
                finalFilePath = newAbsoluteFilePath;
            }
    
            // Main content writing logic - supports both simple save and content splitting
            docUtil.checkFileAccess(finalFilePath, root);
                
            if (split) {
                // Content splitting mode: divide content on '\n~\n' delimiter
                const parts = content.split('\n~\n');
                    
                if (parts.length > 1) {
                    // Extract the original file's ordinal for proper sequencing
                    const originalOrdinal = docUtil.getOrdinalFromName(path.basename(finalFilePath));
                        
                    // Make room for new files by shifting existing ordinals down
                    // Subtract 1 because the original file keeps its position
                    const numberOfNewFiles = parts.length - 1;
                    docUtil.shiftOrdinalsDown(numberOfNewFiles, path.dirname(finalFilePath), originalOrdinal + 1, root, null);
                        
                    // Create a separate file for each content part
                    for (let i = 0; i < parts.length; i++) {
                        // Clean up content by removing whitespace and delimiter artifacts
                        const partContent = parts[i].trim();
                        let partFilePath = finalFilePath;
                            
                        if (i > 0) {
                            // Generate new filenames for additional parts with incremented ordinals
                            const originalBaseName = path.basename(finalFilePath);
                                
                            // Calculate sequential ordinal for this part
                            const newOrdinal = originalOrdinal + i;
                            const ordinalPrefix = newOrdinal.toString().padStart(4, '0');
                                
                            // Construct new filename with updated ordinal
                            const underscoreIndex = originalBaseName.indexOf('_');
                            const nameAfterUnderscore = originalBaseName.substring(underscoreIndex);
                            const finalBaseName = ordinalPrefix + nameAfterUnderscore;
                                
                            partFilePath = path.join(path.dirname(finalFilePath), finalBaseName);
                        }
                            
                        // Write the content part to its designated file
                        docUtil.checkFileAccess(partFilePath, root);
                        fs.writeFileSync(partFilePath, partContent, 'utf8');
                        console.log(`Split file part ${i + 1} saved successfully: ${partFilePath}`);
                    }
                        
                    // Report successful splitting operation
                    console.log(`File split into ${parts.length} parts successfully`);
                    res.json({ success: true, message: `File split into ${parts.length} parts successfully` });
                } else {
                    // No split delimiter found - save as single file
                    fs.writeFileSync(finalFilePath, content, 'utf8');
                    console.log(`File saved successfully: ${finalFilePath}`);
                    res.json({ success: true, message: 'File saved successfully (no split delimiter found)' });
                }
            } else {
                // Standard save operation without content splitting
                fs.writeFileSync(finalFilePath, content, 'utf8');
                console.log(`File saved successfully: ${finalFilePath}`);
                res.json({ success: true, message: 'File saved successfully' });
            }
        } catch (error) {
            // Handle any errors that occurred during the save operation
            svrUtil.handleError(error, res, 'Failed to save file');
        }
    }
    
    /**
     * Renames a folder on the server for the tree viewer feature
     * 
     * This method provides secure folder renaming functionality within the document tree structure.
     * It includes comprehensive validation to prevent naming conflicts and ensure filesystem integrity.
     * 
     * Features:
     * - Validates folder existence before attempting rename
     * - Prevents naming conflicts with existing folders
     * - Maintains filesystem consistency
     * - Supports nested folder structures
     * - Security validation through docUtil.checkFileAccess()
     * 
     * @param req - Express request object containing:
     *   - oldFolderName: string - Current name of the folder to rename
     *   - newFolderName: string - Desired new name for the folder
     *   - treeFolder: string - Relative path to the parent directory
     *   - docRootKey: string - Key identifying the document root configuration
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    renameFolder = async (req: Request<any, any, { oldFolderName: string; newFolderName: string; treeFolder: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Rename Folder Request");
        try {
            // Extract request parameters
            const { oldFolderName, newFolderName, treeFolder, docRootKey } = req.body;
            
            // Validate document root configuration
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            // Validate required parameters
            if (!oldFolderName || !newFolderName || !treeFolder) {
                res.status(400).json({ error: 'Old folder name, new folder name, and treeFolder are required' });
                return;
            }

            // Construct absolute paths for the rename operation
            const absoluteParentPath = path.join(root, treeFolder);
            const oldAbsolutePath = path.join(absoluteParentPath, oldFolderName);
            const newAbsolutePath = path.join(absoluteParentPath, newFolderName);

            // Verify the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Verify the folder to be renamed exists
            if (!fs.existsSync(oldAbsolutePath)) {
                res.status(404).json({ error: 'Old folder not found' });
                return;
            }

            // Ensure the target is actually a directory, not a file
            const stat = fs.statSync(oldAbsolutePath);
            if (!stat.isDirectory()) {
                res.status(400).json({ error: 'Path is not a directory' });
                return;
            }

            // Handle no-op case where names are identical
            if (oldFolderName === newFolderName) {
                res.json({ success: true, message: 'Folder name is unchanged' });
                return;
            }

            // Prevent naming conflicts with existing folders
            if (fs.existsSync(newAbsolutePath)) {
                res.status(409).json({ error: 'A folder with the new name already exists' });
                return;
            }

            // Perform the folder rename operation with security validation
            docUtil.checkFileAccess(oldAbsolutePath, root);
            docUtil.checkFileAccess(newAbsolutePath, root);
            fs.renameSync(oldAbsolutePath, newAbsolutePath);
            
            console.log(`Folder renamed successfully: ${oldAbsolutePath} -> ${newAbsolutePath}`);
            res.json({ success: true, message: 'Folder renamed successfully' });
        } catch (error) {
            // Handle any errors that occurred during the rename operation
            svrUtil.handleError(error, res, 'Failed to rename folder');
        }
    }

    /**
     * Deletes one or more files or folders from the server
     * 
     * This method provides flexible deletion functionality supporting both single-item and batch operations.
     * It safely handles both files and directories with recursive deletion for folders containing nested content.
     * 
     * Features:
     * - Single item deletion via fileOrFolderName parameter
     * - Batch deletion via fileNames array parameter
     * - Recursive directory deletion with force option
     * - Detailed error reporting for batch operations
     * - Security validation for all deletion operations
     * - Backward compatibility for single-item responses
     * 
     * @param req - Express request object containing:
     *   - fileOrFolderName?: string - Single item to delete (legacy parameter)
     *   - fileNames?: string[] - Array of items to delete (batch mode)
     *   - treeFolder: string - Relative path to the parent directory
     *   - docRootKey: string - Key identifying the document root configuration
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    deleteFileOrFolder = async (req: Request<any, any, { fileOrFolderName?: string; fileNames?: string[]; treeFolder: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Delete File or Folder Request");
        try {
            // Extract request parameters
            const { fileOrFolderName, fileNames, treeFolder, docRootKey } = req.body;
            
            // Validate document root configuration
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            // Determine operation mode and build items list
            let itemsToDelete: string[] = [];
            if (fileNames && Array.isArray(fileNames)) {
                // Multiple items mode
                itemsToDelete = fileNames;
            } else if (fileOrFolderName) {
                // Single item mode
                itemsToDelete = [fileOrFolderName];
            } else {
                res.status(400).json({ error: 'Either fileOrFolderName or fileNames array and treeFolder are required' });
                return;
            }

            if (!treeFolder || itemsToDelete.length === 0) {
                res.status(400).json({ error: 'treeFolder and at least one item to delete are required' });
                return;
            }

            // Construct the absolute parent path
            const absoluteParentPath = path.join(root, treeFolder);

            // Check if the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            let deletedCount = 0;
            const errors: string[] = [];

            // Delete each file/folder
            for (const fileName of itemsToDelete) {
                try {
                    const absoluteTargetPath = path.join(absoluteParentPath, fileName);

                    // Check if the target exists
                    if (!fs.existsSync(absoluteTargetPath)) {
                        errors.push(`File or folder not found: ${fileName}`);
                        continue;
                    }

                    // Get stats to determine if it's a file or directory
                    const stat = fs.statSync(absoluteTargetPath);
                    
                    docUtil.checkFileAccess(absoluteTargetPath, root);
                    if (stat.isDirectory()) {
                        // Remove directory recursively
                        fs.rmSync(absoluteTargetPath, { recursive: true, force: true });
                        console.log(`Folder deleted successfully: ${absoluteTargetPath}`);
                    } else {
                        // Remove file
                        fs.unlinkSync(absoluteTargetPath);
                        console.log(`File deleted successfully: ${absoluteTargetPath}`);
                    }
                    
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting ${fileName}:`, error);
                    errors.push(`Failed to delete ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Return appropriate response based on single vs multiple items
            if (itemsToDelete.length === 1) {
                // Single item mode - return simple response for backward compatibility
                if (deletedCount === 1) {
                    const message = itemsToDelete[0].includes('.') ? 'File deleted successfully' : 'Folder deleted successfully';
                    res.json({ success: true, message });
                } else {
                    res.status(500).json({ error: errors[0] || 'Failed to delete item' });
                }
            } else {
                // Multiple items mode - return detailed response
                res.json({ 
                    success: true, 
                    deletedCount, 
                    errors: errors.length > 0 ? errors : undefined,
                    message: `Successfully deleted ${deletedCount} of ${itemsToDelete.length} items` 
                });
            }
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to delete file or folder');
        }
    }

    /**
     * Moves a file or folder up or down in the ordered list by swapping numeric prefixes
     * 
     * This method implements ordinal-based repositioning for files and folders within a directory.
     * It works by swapping the numeric prefixes (ordinals) between the target item and an adjacent item
     * to change their display order in the tree viewer.
     * 
     * How it works:
     * - Files/folders use numeric prefixes (e.g., "0001_", "0002_") to determine sort order
     * - "Move up" swaps ordinals with the item that has the next lower ordinal
     * - "Move down" swaps ordinals with the item that has the next higher ordinal
     * - Uses temporary file renaming to prevent naming conflicts during the swap
     * 
     * Features:
     * - Supports both files and directories
     * - Validates movement boundaries (can't move up from top, down from bottom)
     * - Atomic operation using temporary files to prevent conflicts
     * - Returns detailed information about the swap for UI updates
     * - Security validation for all file operations
     * 
     * @param req - Express request object containing:
     *   - direction: string - Movement direction, must be "up" or "down"
     *   - filename: string - Name of the file or folder to move
     *   - treeFolder: string - Relative path to the parent directory
     *   - docRootKey: string - Key identifying the document root configuration
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    moveUpOrDown = async (req: Request<any, any, { direction: string; filename: string; treeFolder: string, docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Move Up/Down Request");
        try {
            // Extract request parameters
            const { direction, filename, treeFolder, docRootKey } = req.body;
            
            // Validate document root configuration
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            // Validate required parameters and direction values
            if (!direction || !filename || !treeFolder || (direction !== 'up' && direction !== 'down')) {
                res.status(400).json({ error: 'Valid direction ("up" or "down"), filename, and treeFolder are required' });
                return;
            }

            // Construct absolute path to the parent directory
            const absoluteParentPath = path.join(root, treeFolder);

            // Verify the parent directory exists
            if (!fs.existsSync(absoluteParentPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Read directory contents and filter for items with numeric ordinal prefixes
            // Only files/folders matching the pattern "NNNN_*" are considered for ordering
            docUtil.checkFileAccess(absoluteParentPath, root);
            const allFiles = fs.readdirSync(absoluteParentPath);
            const numberedFiles = allFiles.filter(file => /^\d+_/.test(file));
            
            // Sort by filename which naturally sorts by numeric prefix due to zero-padding
            numberedFiles.sort((a, b) => a.localeCompare(b));

            // Locate the target file/folder in the ordered list
            const currentIndex = numberedFiles.findIndex(file => file === filename);
            if (currentIndex === -1) {
                res.status(404).json({ error: 'File not found in directory' });
                return;
            }

            // Calculate the target position for the ordinal swap
            let targetIndex: number;
            if (direction === 'up') {
                // Check if already at the top of the list
                if (currentIndex === 0) {
                    res.status(400).json({ error: 'File is already at the top' });
                    return;
                }
                targetIndex = currentIndex - 1;
            } else { // direction === 'down'
                // Check if already at the bottom of the list
                if (currentIndex === numberedFiles.length - 1) {
                    res.status(400).json({ error: 'File is already at the bottom' });
                    return;
                }
                targetIndex = currentIndex + 1;
            }

            // Get the two files that will swap ordinals
            const currentFile = numberedFiles[currentIndex];
            const targetFile = numberedFiles[targetIndex];

            // Extract the numeric ordinal prefixes (including underscore)
            const currentPrefix = currentFile.substring(0, currentFile.indexOf('_') + 1);
            const targetPrefix = targetFile.substring(0, targetFile.indexOf('_') + 1);

            // Extract the actual names without the ordinal prefixes
            const currentName = currentFile.substring(currentFile.indexOf('_') + 1);
            const targetName = targetFile.substring(targetFile.indexOf('_') + 1);

            // Create new filenames by swapping the ordinal prefixes
            const newCurrentName = targetPrefix + currentName;
            const newTargetName = currentPrefix + targetName;

            // Construct full paths for the rename operations
            const currentPath = path.join(absoluteParentPath, currentFile);
            const targetPath = path.join(absoluteParentPath, targetFile);
            const tempPath = path.join(absoluteParentPath, `temp_${Date.now()}_${currentFile}`);

            // Validate all paths for security before proceeding
            docUtil.checkFileAccess(currentPath, root);
            docUtil.checkFileAccess(targetPath, root);
            docUtil.checkFileAccess(tempPath, root);

            // Perform atomic rename operation using temporary file to avoid conflicts
            // Step 1: Move current file to temporary location
            fs.renameSync(currentPath, tempPath);
            // Step 2: Rename target file to current file's new name
            fs.renameSync(targetPath, path.join(absoluteParentPath, newTargetName));
            // Step 3: Move temporary file to target file's new name
            fs.renameSync(tempPath, path.join(absoluteParentPath, newCurrentName));

            console.log(`Files swapped successfully: ${currentFile} <-> ${targetFile}`);
            
            // Return detailed information about the swap for UI updates
            res.json({ 
                success: true, 
                message: 'Files moved successfully',
                oldName1: currentFile,
                newName1: newCurrentName,
                oldName2: targetFile,
                newName2: newTargetName
            });
        } catch (error) {
            // Handle any errors that occurred during the move operation
            svrUtil.handleError(error, res, 'Failed to move file or folder');
        }
    }

    /**
     * Pastes items from the cut list to the target folder by moving them with proper ordinal positioning
     * 
     * This is a sophisticated file/folder moving operation that supports both cross-folder moves and
     * same-folder reordering with intelligent ordinal management. It handles complex scenarios like
     * inserting items at specific positions while maintaining proper ordinal sequencing.
     * 
     * Key Features:
     * - Positional pasting at specific ordinal locations or appending to end
     * - Cross-folder moves with automatic ordinal assignment
     * - Same-folder reordering with conflict resolution using temporary files
     * - Automatic ordinal shifting to make room for new items
     * - Batch operations supporting multiple items simultaneously
     * - Path mapping updates when folder ordinals are shifted
     * - Comprehensive error reporting for failed operations
     * 
     * Ordinal Management:
     * - When inserting at a specific position, existing items are shifted down
     * - Maintains proper 4-digit zero-padded ordinal prefixes (e.g., "0001_", "0002_")
     * - Handles ordinal conflicts during same-folder operations using temporary moves
     * - Updates item paths when parent folders are renumbered during shifting
     * 
     * @param req - Express request object containing:
     *   - targetFolder: string - Relative path to the destination folder
     *   - pasteItems: string[] - Array of item paths to move (automatically sorted)
     *   - docRootKey: string - Key identifying the document root configuration
     *   - targetOrdinal?: string - Optional ordinal position for insertion (items inserted after this)
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */ 
    pasteItems = async (req: Request<any, any, { targetFolder: string; pasteItems: string[], docRootKey: string, targetOrdinal?: string }>, res: Response): Promise<void> => {    
        try {
            const { targetFolder, pasteItems, docRootKey, targetOrdinal } = req.body;
    
            // sort the pasteItems string[] to ensure they are in the correct order
            pasteItems.sort((a, b) => a.localeCompare(b));
    
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad key' });
                return;
            }
    
            if (!targetFolder || !pasteItems || !Array.isArray(pasteItems) || pasteItems.length === 0) {
                res.status(400).json({ error: 'targetFolder and pasteItems array are required' });
                return;
            }
    
            // Construct the absolute target path
            const absoluteTargetPath = path.join(root, targetFolder);
    
            // Check if the target directory exists
            docUtil.checkFileAccess(absoluteTargetPath, root);
            if (!fs.existsSync(absoluteTargetPath)) {
                res.status(404).json({ error: 'Target directory not found' });
                return;
            }
    
            let pastedCount = 0;
            const errors: string[] = [];
    
            // Determine insert ordinal for positional pasting
            let insertOrdinal: number | null = null;
            if (targetOrdinal) {
                const underscoreIndex = targetOrdinal.indexOf('_');
                if (underscoreIndex > 0) {
                    const targetOrdinalNum = parseInt(targetOrdinal.substring(0, underscoreIndex));
                    insertOrdinal = targetOrdinalNum + 1; // Insert after the target
                }
            }
    
            if (!insertOrdinal) {
                insertOrdinal = 0; // Default to inserting at the top if no ordinal is specified
            }
    
            // Shift existing items down to make room for the number of items being pasted
            // For same-folder reordering, we need to handle conflicts by temporarily moving files
            // For cross-folder moves, we don't ignore any items since they're coming from different directories
            let itemsToIgnore: string[] | null = null;
            const tempMoves: { tempPath: string; originalPath: string; finalName: string }[] = [];
            
            // Check if any of the items being pasted are from the same target directory
            const targetFolderNormalized = targetFolder === '/' ? '' : targetFolder;
            const isSameFolderOperation = pasteItems.some(fullPath => {
                const itemDir = path.dirname(fullPath);
                const itemDirNormalized = itemDir === '.' ? '' : itemDir;
                return itemDirNormalized === targetFolderNormalized;
            });
            
            if (isSameFolderOperation) {
                // For same-folder operations, temporarily move files out of the way first
                // This prevents conflicts during ordinal shifting
                for (let i = 0; i < pasteItems.length; i++) {
                    const itemFullPath = pasteItems[i];
                    const itemDir = path.dirname(itemFullPath);
                    const itemDirNormalized = itemDir === '.' ? '' : itemDir;
                    
                    // Only handle items from the same directory
                    if (itemDirNormalized === targetFolderNormalized) {
                        const itemName = path.basename(itemFullPath);
                        const sourceFilePath = path.join(root, itemFullPath);
                        
                        if (fs.existsSync(sourceFilePath)) {
                            // Create temporary filename
                            const tempName = `temp_paste_${Date.now()}_${i}_${itemName}`;
                            const tempPath = path.join(absoluteTargetPath, tempName);
                            
                            // Move to temporary location
                            fs.renameSync(sourceFilePath, tempPath);
                            
                            // Calculate final name with new ordinal
                            const currentOrdinal = insertOrdinal + i;
                            const nameWithoutPrefix = itemName.includes('_') ? 
                                itemName.substring(itemName.indexOf('_') + 1) : itemName;
                            const newOrdinalPrefix = currentOrdinal.toString().padStart(4, '0');
                            const finalName = `${newOrdinalPrefix}_${nameWithoutPrefix}`;
                            
                            tempMoves.push({
                                tempPath,
                                originalPath: sourceFilePath,
                                finalName
                            });
                        }
                    }
                }
                
                // Now all same-folder items are out of the way, so don't ignore anything during shifting
                itemsToIgnore = null;
            }
            
            const pathMapping = docUtil.shiftOrdinalsDown(pasteItems.length, absoluteTargetPath, insertOrdinal, root, itemsToIgnore);
            
            // Update pasteItems with new paths after ordinal shifting
            for (let i = 0; i < pasteItems.length; i++) {
                const originalPath = pasteItems[i];
                // console.log('  Checking if mapped to new name:', originalPath);
                
                // Normalize the path by removing leading slash for comparison
                const normalizedOriginalPath = originalPath.startsWith('/') ? originalPath.substring(1) : originalPath;
                
                // Check if any folder in the path hierarchy was renamed
                let updatedPath = originalPath;
                let pathChanged = false;
                
                // Check each mapping to see if it affects this file's path
                for (const [oldFolderPath, newFolderPath] of pathMapping) {
                    // Check if the file path starts with the old folder path
                    if (normalizedOriginalPath.startsWith(oldFolderPath + '/') || normalizedOriginalPath === oldFolderPath) {
                        // Replace the old folder path with the new one
                        const relativePart = normalizedOriginalPath.substring(oldFolderPath.length);
                        const newNormalizedPath = newFolderPath + relativePart;
                        updatedPath = originalPath.startsWith('/') ? '/' + newNormalizedPath : newNormalizedPath;
                        pathChanged = true;
                        // console.log(`    Updated paste item path: ${originalPath} -> ${updatedPath}`);
                        break;
                    }
                }
                
                if (pathChanged) {
                    pasteItems[i] = updatedPath;
                } else {
                    // console.log(`    No mapping needed for: ${originalPath}`);
                }
            }
                
            // Move each file/folder
            for (let i = 0; i < pasteItems.length; i++) {
                const itemFullPath = pasteItems[i];
                try {
                    const itemDir = path.dirname(itemFullPath);
                    const itemDirNormalized = itemDir === '.' ? '' : itemDir;
                    const isFromSameFolder = itemDirNormalized === targetFolderNormalized;
                    
                    if (isFromSameFolder && tempMoves.length > 0) {
                        // Handle same-folder moves using temporary files
                        const tempMove = tempMoves.find(tm => path.basename(tm.originalPath) === path.basename(itemFullPath));
                        if (tempMove) {
                            const finalFilePath = path.join(absoluteTargetPath, tempMove.finalName);
                            // Move from temp location to final location
                            fs.renameSync(tempMove.tempPath, finalFilePath);
                            pastedCount++;
                        } else {
                            errors.push(`Temporary file not found for ${itemFullPath}`);
                        }
                    } else {
                        // Handle cross-folder moves (regular logic)
                        const itemName = path.basename(itemFullPath);
                        const sourceFilePath = path.join(root, itemFullPath);
                        
                        // Check if source file exists
                        if (!fs.existsSync(sourceFilePath)) {
                            console.error(`Source file not found: ${itemFullPath}`);
                            errors.push(`Source file not found: ${itemFullPath}`);
                            continue;
                        }

                        let targetFileName = itemName;
                        const currentOrdinal = insertOrdinal + i;
                                
                        // Extract name without ordinal prefix if it exists
                        const nameWithoutPrefix = itemName.includes('_') ? 
                            itemName.substring(itemName.indexOf('_') + 1) : itemName;
                                
                        // Create new filename with correct ordinal
                        const newOrdinalPrefix = currentOrdinal.toString().padStart(4, '0');
                        targetFileName = `${newOrdinalPrefix}_${nameWithoutPrefix}`;
                            
        
                        const targetFilePath = path.join(absoluteTargetPath, targetFileName);

                        // Safety check: ensure target doesn't already exist to prevent overwriting
                        if (fs.existsSync(targetFilePath)) {
                            console.error(`Target file already exists, skipping: ${targetFilePath}`);
                            errors.push(`Target file already exists: ${targetFileName}`);
                            continue;
                        }

                        // Move the file/folder
                        fs.renameSync(sourceFilePath, targetFilePath);                    
                        pastedCount++;
                    }
                } catch (error) {
                    console.error(`Error moving ${itemFullPath}:`, error);
                    errors.push(`Failed to move ${itemFullPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
    
            // Return response
            res.json({
                success: pastedCount > 0,
                pastedCount,
                totalItems: pasteItems.length,
                errors: errors.length > 0 ? errors : undefined,
                message: `Successfully pasted ${pastedCount} of ${pasteItems.length} items`
            });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to paste items');
        }
    }
    
    /**
     * Joins multiple selected files by concatenating their content and saving to the first file
     * 
     * This method combines the content of multiple text files into a single file, preserving the ordinal
     * order for proper sequencing. It's useful for merging split documents or combining related content
     * that was previously separated across multiple files.
     * 
     * Process:
     * 1. Validates that at least 2 files are selected for joining
     * 2. Reads content from all selected files
     * 3. Sorts files by their ordinal prefixes to maintain proper order
     * 4. Concatenates content with double newline separators ("\n\n")
     * 5. Saves the combined content to the first file (by ordinal order)
     * 6. Deletes all other files that were joined
     * 
     * Features:
     * - Requires minimum of 2 files for joining operation
     * - Automatically sorts files by ordinal before joining
     * - Handles text files with UTF-8 encoding
     * - Graceful error handling for unreadable files
     * - Content separation with consistent double newlines
     * - Atomic operation - either all files join successfully or none do
     * 
     * Security:
     * - Validates file existence before attempting to read
     * - Ensures all file operations stay within the configured document root
     * - Properly handles file access permissions
     * 
     * @param req - Express request object containing:
     *   - filenames: string[] - Array of filenames to join (minimum 2 required)
     *   - treeFolder: string - Relative path to the parent directory
     *   - docRootKey: string - Key identifying the document root configuration
     * @param res - Express response object for sending results
     * @returns void - Synchronous operation, no Promise needed
     */
    joinFiles = (req: Request<any, any, { filenames: string[]; treeFolder: string; docRootKey: string }>, res: Response): void => {
        try {
            // Extract request parameters
            const { filenames, treeFolder, docRootKey } = req.body;
            
            // Validate document root configuration
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }
        
            // Validate that we have enough files to perform a join operation
            if (!filenames || !Array.isArray(filenames) || filenames.length < 2) {
                res.status(400).json({ error: 'At least 2 filenames are required for joining' });
                return;
            }
        
            // Validate required tree folder parameter
            if (!treeFolder) {
                res.status(400).json({ error: 'Tree folder is required' });
                return;
            }
        
            // Construct absolute path and validate security access
            const absoluteFolderPath = path.join(root, treeFolder);
            docUtil.checkFileAccess(absoluteFolderPath, root);
        
            // Read content from all files and collect metadata for sorting
            const fileData: { filename: string; ordinal: number; content: string }[] = [];
                    
            for (const filename of filenames) {
                // Construct path and validate file access permissions
                const absoluteFilePath = path.join(absoluteFolderPath, filename);
                docUtil.checkFileAccess(absoluteFilePath, root);
                        
                // Verify file exists before attempting to read
                if (!fs.existsSync(absoluteFilePath)) {
                    res.status(404).json({ error: `File not found: ${filename}` });
                    return;
                }
        
                // Extract ordinal number for proper sorting
                const ordinal = docUtil.getOrdinalFromName(filename);
                        
                // Read file content with error handling for unreadable files
                let content = '';
                try {
                    content = fs.readFileSync(absoluteFilePath, 'utf8');
                } catch (error) {
                    console.warn(`Could not read file ${filename} as text:`, error);
                    // Continue with empty content rather than failing the entire operation
                }
        
                // Store file data for sorting and joining
                fileData.push({ filename, ordinal, content });
            }
        
            // Sort files by ordinal to maintain proper document order
            fileData.sort((a, b) => a.ordinal - b.ordinal);
        
            // Concatenate content with consistent double newline separators
            const joinedContent = fileData.map(file => file.content).join('\n\n');
        
            // Save combined content to the first file (lowest ordinal)
            const firstFile = fileData[0];
            const firstFilePath = path.join(absoluteFolderPath, firstFile.filename);
                    
            // Write the joined content with security validation
            docUtil.checkFileAccess(firstFilePath, root);
            fs.writeFileSync(firstFilePath, joinedContent, 'utf8');
            console.log(`Joined content saved to: ${firstFile.filename}`);
        
            // Clean up by deleting all files except the first one
            const deletedFiles: string[] = [];
            for (let i = 1; i < fileData.length; i++) {
                const fileToDelete = fileData[i];
                const deleteFilePath = path.join(absoluteFolderPath, fileToDelete.filename);
                        
                try {
                    // Validate access and delete the file
                    docUtil.checkFileAccess(deleteFilePath, root);
                    fs.unlinkSync(deleteFilePath);
                    deletedFiles.push(fileToDelete.filename);
                    console.log(`Deleted file: ${fileToDelete.filename}`);
                } catch (error) {
                    console.error(`Error deleting file ${fileToDelete.filename}:`, error);
                    // Continue with other deletions even if one fails
                }
            }
        
            // Return success response with operation details
            res.json({ 
                success: true, 
                message: `Successfully joined ${fileData.length} files into ${firstFile.filename}`,
                joinedFile: firstFile.filename,
                deletedFiles: deletedFiles
            });
        
        } catch (error) {
            // Handle any errors that occurred during the join operation
            svrUtil.handleError(error, res, 'Failed to join files');
        }
    }

    /**
     * Converts a file into a folder by using the first line of the file's content as the folder name
     * 
     * This method provides a unique transformation feature that converts an existing file into a folder structure.
     * It's useful for reorganizing content when a simple file needs to be expanded into a more complex
     * hierarchical structure while preserving the existing content.
     * 
     * Process:
     * 1. Validates the existing file and proposed folder name
     * 2. Extracts and preserves the numeric ordinal prefix from the original filename
     * 3. Deletes the original file from the filesystem
     * 4. Creates a new folder with the same ordinal prefix and the specified name
     * 5. If remaining content exists, creates a new file inside the folder with that content
     * 
     * Features:
     * - Preserves ordinal positioning in the document tree
     * - Validates folder name length to prevent filesystem issues
     * - Handles optional content preservation in a new file
     * - Prevents conflicts with existing folders
     * - Maintains proper security access controls
     * - Atomic operation - either fully succeeds or fails cleanly
     * 
     * Ordinal Preservation:
     * - The new folder inherits the numeric prefix from the original file
     * - This maintains the position in the sorted document tree
     * - Example: "0003_myfile.md" becomes "0003_myfolder/"
     * 
     * Content Handling:
     * - If remainingContent is provided, creates "0001_file.md" inside the new folder
     * - This allows preservation of the original file's content after the conversion
     * - The new file gets the default ordinal "0001" within the folder
     * 
     * @param req - Express request object containing:
     *   - filename: string - Name of the existing file to convert
     *   - folderName: string - Desired name for the new folder (without ordinal prefix)
     *   - remainingContent: string - Optional content to save in a new file inside the folder
     *   - treeFolder: string - Relative path to the parent directory
     *   - docRootKey: string - Key identifying the document root configuration
     * @param res - Express response object for sending results
     * @returns Promise<void> - Resolves when operation completes
     */
    makeFolder = async (req: Request<any, any, { filename: string; folderName: string; remainingContent: string; treeFolder: string; docRootKey: string }>, res: Response): Promise<void> => {
        console.log("Make Folder Request");
        try {
            // Extract request parameters
            const { filename, folderName, remainingContent, treeFolder, docRootKey } = req.body;
            
            // Validate document root configuration
            const root = config.getPublicFolderByKey(docRootKey).path;
            if (!root) {
                res.status(500).json({ error: 'bad root' });
                return;
            }

            // Validate required parameters
            if (!filename || !folderName || !treeFolder) {
                res.status(400).json({ error: 'Filename, folder name, and treeFolder are required' });
                return;
            }

            // Prevent excessively long folder names that could cause filesystem issues
            if (folderName.length > 140) {
                res.status(400).json({ error: 'Folder name is too long. Maximum 140 characters allowed.' });
                return;
            }

            // Construct absolute paths for the conversion operation
            const absoluteFolderPath = path.join(root, treeFolder);
            const absoluteFilePath = path.join(absoluteFolderPath, filename);

            // Verify the parent directory exists and is accessible
            docUtil.checkFileAccess(absoluteFolderPath, root);
            if (!fs.existsSync(absoluteFolderPath)) {
                res.status(404).json({ error: 'Parent directory not found' });
                return;
            }

            // Verify the target file exists
            if (!fs.existsSync(absoluteFilePath)) {
                res.status(404).json({ error: 'File not found' });
                return;
            }

            // Ensure the target is actually a file, not a directory
            const fileStat = fs.statSync(absoluteFilePath);
            if (!fileStat.isFile()) {
                res.status(400).json({ error: 'Path is not a file' });
                return;
            }

            // Extract and preserve the numeric ordinal prefix from the original filename
            // This maintains the position in the document tree after conversion
            const underscoreIndex = filename.indexOf('_');
            const numericPrefix = underscoreIndex !== -1 ? filename.substring(0, underscoreIndex + 1) : '';
            
            // Construct the new folder name with preserved ordinal prefix
            const newFolderName = numericPrefix + folderName;
            const absoluteNewFolderPath = path.join(absoluteFolderPath, newFolderName);

            // Prevent naming conflicts with existing folders
            if (fs.existsSync(absoluteNewFolderPath)) {
                res.status(409).json({ error: 'A folder with this name already exists' });
                return;
            }

            // Perform the conversion: delete original file and create folder
            // Step 1: Remove the original file with security validation
            docUtil.checkFileAccess(absoluteFilePath, root);
            fs.unlinkSync(absoluteFilePath);
            console.log(`File deleted: ${absoluteFilePath}`);

            // Step 2: Create the new folder structure
            docUtil.checkFileAccess(absoluteNewFolderPath, root);
            fs.mkdirSync(absoluteNewFolderPath, { recursive: true });
            console.log(`Folder created: ${absoluteNewFolderPath}`);

            // Step 3: Optionally preserve content in a new file inside the folder
            if (remainingContent && remainingContent.trim().length > 0) {
                // Create a default file with ordinal "0001" to store the remaining content
                const newFileName = '0001_file.md';
                const newFilePath = path.join(absoluteNewFolderPath, newFileName);
                
                // Write the preserved content with security validation
                docUtil.checkFileAccess(newFilePath, root);
                fs.writeFileSync(newFilePath, remainingContent, 'utf8');
                console.log(`New file created with remaining content: ${newFilePath}`);
            }

            // Return success response with conversion details
            res.json({ 
                success: true, 
                message: `File "${filename}" converted to folder "${newFolderName}" successfully${remainingContent && remainingContent.trim().length > 0 ? ' with remaining content saved as 0001_file.md' : ''}`,
                folderName: newFolderName
            });
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to convert file to folder');
        }
    }        
}
export const docMod = new DocMod();
