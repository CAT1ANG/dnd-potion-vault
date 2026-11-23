$ErrorActionPreference = 'Stop'
$ruleName = 'DND Potion Prototype'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existing) {
  Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Profile Any -Direction Inbound -Action Allow
  Get-NetFirewallRule -DisplayName $ruleName | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort 5173
} else {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Description 'Allows the local DND potion prototype only from devices on the same local network.' `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 5173 `
    -RemoteAddress LocalSubnet `
    -Profile Any | Out-Null
}
