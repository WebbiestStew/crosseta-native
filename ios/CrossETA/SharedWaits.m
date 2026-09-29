// Exposes the Swift SharedWaits module (SharedWaits.swift) to React Native.
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SharedWaits, NSObject)

RCT_EXTERN_METHOD(save:(NSString *)json)

@end
