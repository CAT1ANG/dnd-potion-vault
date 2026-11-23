$ErrorActionPreference = 'Stop'
$prototypeApi = 'http://127.0.0.1:5173/api/prototype'

function Invoke-PrototypePost {
  param([hashtable]$Body)
  Invoke-RestMethod -Method Post -Uri $prototypeApi -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8 -Compress)
}

$batch = Invoke-PrototypePost @{ action = 'create_batch'; items = @(@{ potionId = 'healing-common'; quantity = 1 }) }
if ($batch.items.Count -ne 1) { throw 'Batch did not contain exactly one potion.' }
$token = ($batch.items[0].url -split '#p=')[1]
if ($token.Length -ne 48) { throw 'Generated token has an unexpected length.' }

$deviceA = [guid]::NewGuid().ToString()
$deviceB = [guid]::NewGuid().ToString()
$claimA = Invoke-PrototypePost @{ action = 'claim'; token = $token; deviceId = $deviceA }
$inventoryA = Invoke-RestMethod -Uri "$prototypeApi`?deviceId=$deviceA"
if ($inventoryA.items.Count -ne 1) { throw 'The first device did not receive the potion.' }

$claimB = Invoke-PrototypePost @{ action = 'claim'; token = $token; deviceId = $deviceB }
$inventoryAAfter = Invoke-RestMethod -Uri "$prototypeApi`?deviceId=$deviceA"
$inventoryB = Invoke-RestMethod -Uri "$prototypeApi`?deviceId=$deviceB"
if ($inventoryAAfter.items.Count -ne 0 -or $inventoryB.items.Count -ne 1 -or -not $claimB.transferred) {
  throw 'Ownership transfer did not update both inventories.'
}

$oldOwnerRejected = $false
try {
  Invoke-PrototypePost @{ action = 'consume'; itemId = $claimA.item.id; deviceId = $deviceA } | Out-Null
} catch {
  $oldOwnerRejected = $_.Exception.Response.StatusCode.value__ -eq 409
}
if (-not $oldOwnerRejected) { throw 'The previous owner was allowed to consume the transferred potion.' }

$consumed = Invoke-PrototypePost @{ action = 'consume'; itemId = $claimB.item.id; deviceId = $deviceB }
$inventoryBAfter = Invoke-RestMethod -Uri "$prototypeApi`?deviceId=$deviceB"
if ($consumed.outcome.amount -lt 4 -or $consumed.outcome.amount -gt 10 -or $inventoryBAfter.items.Count -ne 0) {
  throw 'Consumption result or inventory cleanup is invalid.'
}

Write-Output "PASS: QR generated, ownership moved A -> B, old owner rejected, current owner healed for $($consumed.outcome.amount)."
