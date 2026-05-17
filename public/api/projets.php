<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$file = __DIR__ . '/../data/projets.json';
if (!file_exists($file)) {
    echo '[]';
    exit;
}
readfile($file);
