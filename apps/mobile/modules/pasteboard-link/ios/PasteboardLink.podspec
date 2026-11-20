Pod::Spec.new do |s|
  s.name           = 'PasteboardLink'
  s.version        = '1.0.0'
  s.summary        = 'Asks iOS whether the pasteboard probably holds a web link'
  s.homepage       = 'https://norish.dev'
  s.license        = 'AGPL-3.0'
  s.authors        = 'Norish'
  s.source         = { :git => 'https://github.com/norish-recipes/norish.git', :tag => s.version.to_s }
  s.platforms      = { :ios => '16.4' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
end
