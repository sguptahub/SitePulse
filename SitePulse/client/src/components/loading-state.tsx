import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <Card className="shadow-sm border border-border p-8 mb-8" data-testid="loading-state">
      <CardContent className="p-0">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Analyzing Website...</h3>
          <p className="text-muted-foreground mb-4">This may take a few moments</p>
          <div className="max-w-md mx-auto bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500 animate-pulse" 
              style={{ width: "65%" }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
