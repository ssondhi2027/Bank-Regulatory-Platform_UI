package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class DashboardPage {

    private final WebDriver driver;

    private final By pageHeading =
            By.cssSelector("h1");

    public DashboardPage(WebDriver driver) {

        this.driver = driver;
    }

    public void open() {

        driver.get(
                System.getProperty(
                        "ui.base.url",
                        "https://YOUR-NETLIFY-URL.netlify.app"
                )
        );
    }

    public boolean isLoaded() {

        return driver.findElement(
                pageHeading
        ).isDisplayed();
    }

    public String getPageTitle() {

        return driver.getTitle();
    }
}