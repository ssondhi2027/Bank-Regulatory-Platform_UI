package base;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

import utils.Config;

import java.time.Duration;

public class BaseTest {

    protected WebDriver driver;

    @BeforeMethod
    public void setUp() {

        ChromeOptions options =
                new ChromeOptions();

        String headless =
                Config.get("headless");

        if ("true".equalsIgnoreCase(headless)) {

            options.addArguments("--headless=new");
        }

        options.addArguments("--window-size=1920,1080");
        options.addArguments("--disable-gpu");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");

        driver =
                new ChromeDriver(options);

        driver.manage()
                .timeouts()
                .implicitlyWait(
                        Duration.ofSeconds(
                                Long.parseLong(
                                        Config.get("timeout")
                                )
                        )
                );
    }

    @AfterMethod
    public void tearDown() {

        if (driver != null) {

            driver.quit();
        }
    }
}