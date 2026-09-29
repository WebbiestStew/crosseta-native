# Adds the CrossETAWidget extension and the SharedWaits native module to CrossETA.xcodeproj.
# Run once from /ios (it refuses to run twice):
#   GEM_HOME=/opt/homebrew/Cellar/cocoapods/<version>/libexec LANG=en_US.UTF-8 \
#     /opt/homebrew/opt/ruby/bin/ruby scripts/add_widget.rb
require 'xcodeproj'

WIDGET = 'CrossETAWidget'
proj = Xcodeproj::Project.open('CrossETA.xcodeproj')
app = proj.targets.find { |t| t.name == 'CrossETA' } or abort 'CrossETA target not found'
abort "#{WIDGET} already exists; nothing to do" if proj.targets.any? { |t| t.name == WIDGET }

app_release = app.build_configurations.find { |c| c.name == 'Release' }.build_settings
team = app_release['DEVELOPMENT_TEAM']
version = app_release['MARKETING_VERSION']
build = app_release['CURRENT_PROJECT_VERSION']
deployment = app_release['IPHONEOS_DEPLOYMENT_TARGET']

# ── Native module in the app target ─────────────────────────────────────────
app_group = proj.main_group['CrossETA']
app.add_file_references(%w[SharedWaits.m SharedWaits.swift].map { |f| app_group.new_file("CrossETA/#{f}") })

# ── Widget extension target ─────────────────────────────────────────────────
ext = proj.new_target(:app_extension, WIDGET, :ios, deployment)
group = proj.main_group.new_group(WIDGET, WIDGET)
swift = group.new_file('CrossETAWidget.swift')
group.new_file('Info.plist')
group.new_file('CrossETAWidget.entitlements')
ext.add_file_references([swift])
%w[WidgetKit SwiftUI].each { |fw| ext.add_system_framework(fw) }

ext.build_configurations.each do |config|
  config.build_settings.merge!(
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.diegovillarreal.crosseta.widget',
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'INFOPLIST_FILE' => "#{WIDGET}/Info.plist",
    'CODE_SIGN_ENTITLEMENTS' => "#{WIDGET}/#{WIDGET}.entitlements",
    'CODE_SIGN_STYLE' => 'Automatic',
    'CODE_SIGN_IDENTITY' => 'Apple Development',
    'DEVELOPMENT_TEAM' => team,
    'SWIFT_VERSION' => '5.0',
    'TARGETED_DEVICE_FAMILY' => '1',
    'IPHONEOS_DEPLOYMENT_TARGET' => deployment,
    'MARKETING_VERSION' => version,
    'CURRENT_PROJECT_VERSION' => build,
    'GENERATE_INFOPLIST_FILE' => 'NO',
    'SKIP_INSTALL' => 'YES',
    'LD_RUNPATH_SEARCH_PATHS' => '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks',
    'CLANG_ENABLE_MODULES' => 'YES',
    'SWIFT_EMIT_LOC_STRINGS' => 'YES'
  )
end

# ── Embed the extension in the app ──────────────────────────────────────────
app.add_dependency(ext)
embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
build_file = embed.add_file_reference(ext.product_reference, true)
build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
# Run the embed step before the script phases so Xcode 15+ does not report a dependency cycle.
app.build_phases.delete(embed)
first_script = app.build_phases.index { |p| p.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) } || app.build_phases.length
app.build_phases.insert(first_script, embed)

proj.save
puts "Added #{WIDGET} and SharedWaits.m"
