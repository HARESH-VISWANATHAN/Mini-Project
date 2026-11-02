import tests.TestScenarios;
import ui.ConsoleMenu;
import ui.DesktopApp;

/** Entry point: desktop GUI by default; use --console or --tests as needed. */
public class Main {
    public static void main(String[] args) {
        if (args.length > 0 && args[0].equalsIgnoreCase("--tests")) {
            TestScenarios.runAll();
        } else if (args.length > 0 && args[0].equalsIgnoreCase("--console")) {
            new ConsoleMenu().run();
        } else {
            DesktopApp.launch();
        }
    }
}
