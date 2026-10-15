<?php
require __DIR__ . '/config.php';
session_boot();
$_SESSION = [];
session_destroy();
redirect('index.php');
