package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class ScorecardPage {

    private final WebDriver driver;

    private final By heading =
            By.xpath(
                "//h1[contains(.,'Control scorecard')]"
            );

    private final By passwordInput =
            By.cssSelector(
                "input[type='password']"
            );

    private final By unlockButton =
            By.xpath(
                "//button[contains(.,'Unlock')]"
            );

    public ScorecardPage(WebDriver driver) {

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

    public boolean isPasswordGateDisplayed() {

        return driver.findElements(
                passwordInput
        ).size() > 0;
    }

    public void enterPassword(String password) {

        driver.findElement(
                passwordInput
        ).sendKeys(password);

        driver.findElement(
                unlockButton
        ).click();
    }

    public boolean isScorecardDisplayed() {

        return driver.findElements(
                heading
        ).size() > 0;
    }
}